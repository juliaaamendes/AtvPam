import { showAlert } from "./feedback";
import { AppState, Linking, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";
import { CHECK_DURATION_MS, Coordinates, MotionWindow } from "./domain";

export function permissionInstructions(resource: string) {
  const path =
    Platform.OS === "ios"
      ? `Abra Ajustes > Apps > Campo (ou Expo Go) e permita ${resource}.`
      : `Abra Configurações > Aplicativos > Campo (ou Expo Go) > Permissões e permita ${resource}.`;
  showAlert(
    "Permissão bloqueada",
    `${path}\n\nDepois, volte ao aplicativo e tente novamente.`,
    [
      { text: "Agora não", style: "cancel" },
      {
        text: "Abrir configurações",
        onPress: () => {
          Linking.openSettings().catch(() =>
            showAlert("Abra as configurações manualmente", path),
          );
        },
      },
    ],
  );
}

export async function takePhoto(): Promise<string | null> {
  if (Platform.OS === "web")
    throw new Error(
      "Use o aplicativo no Android ou iPhone para capturar a foto com a câmera nativa.",
    );
  let permission = await ImagePicker.getCameraPermissionsAsync();
  if (!permission.granted && permission.canAskAgain)
    permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    if (!permission.canAskAgain) permissionInstructions("o acesso à câmera");
    else
      showAlert(
        "Câmera não autorizada",
        "A foto precisa da sua permissão. Toque em Fotografar para tentar novamente. Você pode continuar preenchendo a visita.",
      );
    return null;
  }
  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: false,
    });
    return result.canceled ? null : (result.assets[0]?.uri ?? null);
  } catch {
    throw new Error(
      "Não foi possível abrir a câmera. Verifique se o aparelho possui uma câmera disponível e se ela está em uso por outro aplicativo.",
    );
  }
}

export async function captureLocation(): Promise<Coordinates | null> {
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error(
      "O GPS está desligado. Ative a localização nas configurações do aparelho e tente novamente.",
    );
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && permission.canAskAgain)
    permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    if (!permission.canAskAgain) permissionInstructions("a localização");
    else
      showAlert(
        "Localização não autorizada",
        "Permita o acesso à localização para registrar as coordenadas desta visita.",
      );
    return null;
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "O GPS não respondeu em 15 segundos. Vá para um local aberto e tente novamente.",
              ),
            ),
          15000,
        );
      }),
    ]);
    const { latitude, longitude, accuracy } = position.coords;
    return {
      latitude,
      longitude,
      accuracy: accuracy != null && accuracy >= 0 ? accuracy : null,
      capturedAt: position.timestamp,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function verifyMotion(
  signal: AbortSignal,
  onSample: (g: number, progress: number) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let subscription: ReturnType<typeof Accelerometer.addListener> | undefined;
    let appStateSubscription:
      ReturnType<typeof AppState.addEventListener> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let setupTimer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    const finish = (error?: Error, peak = 0) => {
      if (finished) return;
      finished = true;
      subscription?.remove();
      appStateSubscription?.remove();
      clearTimeout(timer);
      clearTimeout(setupTimer);
      signal.removeEventListener("abort", cancel);
      if (error) reject(error);
      else resolve(peak);
    };
    const cancel = () =>
      finish(
        new Error(
          "Verificação interrompida. Mantenha o aplicativo aberto e tente concluir novamente.",
        ),
      );
    signal.addEventListener("abort", cancel);
    if (signal.aborted) {
      cancel();
      return;
    }
    setupTimer = setTimeout(
      () =>
        finish(
          new Error(
            "O sensor de movimento não respondeu. Verifique as permissões e tente novamente.",
          ),
        ),
      15000,
    );
    void (async () => {
      try {
        if (Platform.OS === "web")
          throw new Error(
            "Conclua a visita no Android ou iPhone para validar o acelerômetro nativo. O histórico continua disponível.",
          );
        const permission = await Accelerometer.requestPermissionsAsync();
        if (finished) return;
        if (!permission.granted) {
          if (!permission.canAskAgain)
            permissionInstructions("os sensores de movimento");
          throw new Error(
            "Permita o sensor de movimento para verificar a estabilidade do aparelho.",
          );
        }
        const available = await Accelerometer.isAvailableAsync();
        if (finished) return;
        if (!available)
          throw new Error(
            "Acelerômetro indisponível neste aparelho. O fechamento exige um sensor ativo; você ainda pode consultar o histórico.",
          );
        if (AppState.currentState !== "active") {
          cancel();
          return;
        }
        appStateSubscription = AppState.addEventListener("change", (state) => {
          if (state !== "active") cancel();
        });
        clearTimeout(setupTimer);
        const window = new MotionWindow(Date.now());
        Accelerometer.setUpdateInterval(50);
        subscription = Accelerometer.addListener((sample) => {
          const now = Date.now();
          const g = window.add(sample, now);
          if (window.unstable) {
            finish(new Error("Instabilidade Física Detectada"));
            return;
          }
          onSample(
            g,
            Math.min((now - window.startedAt) / CHECK_DURATION_MS, 1),
          );
        });
        timer = setTimeout(() => {
          const result = window.result(Date.now());
          finish(
            result === "stable"
              ? undefined
              : new Error(
                  result === "unstable"
                    ? "Instabilidade Física Detectada"
                    : "Leituras insuficientes do acelerômetro. Mantenha o aplicativo aberto e tente novamente.",
                ),
            window.peakG,
          );
        }, CHECK_DURATION_MS);
      } catch (error) {
        finish(
          error instanceof Error
            ? error
            : new Error("Não foi possível acessar o sensor de movimento."),
        );
      }
    })();
  });
}
