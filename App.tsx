import { showAlert } from "./src/feedback";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Coordinates, gpsQuality, Visit } from "./src/domain";
import { captureLocation, takePhoto, verifyMotion } from "./src/hardware";
import { loadVisits, saveVisit } from "./src/storage";

const C = {
  green: "#214D38",
  ink: "#253B2E",
  muted: "#728074",
  paper: "#F6F7F2",
  line: "#E3E8DE",
  lime: "#DCEBBD",
  orange: "#C96539",
};
type IconName = React.ComponentProps<typeof Ionicons>["name"];
type Tab = "home" | "new" | "history";
const emptyForm = {
  farm: "",
  technician: "",
  crop: "",
  notes: "",
  condition: "Regular" as Visit["condition"],
};
const date = (value: string) =>
  new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function Icon({
  name,
  color = C.green,
  size = 22,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
function Button({
  title,
  icon,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  icon?: IconName;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (pressed || disabled) && { opacity: 0.55 },
      ]}
    >
      {icon && (
        <Icon name={icon} color={secondary ? C.green : "#fff"} size={19} />
      )}
      <Text style={[s.buttonText, secondary && { color: C.green }]}>
        {title}
      </Text>
    </Pressable>
  );
}
function GPSBadge({ location }: { location: Coordinates | null }) {
  const quality = gpsQuality(location?.accuracy);
  return (
    <View style={[s.badge, { backgroundColor: quality.background }]}>
      <View style={[s.dot, { backgroundColor: quality.color }]} />
      <Text style={{ color: quality.color, fontSize: 12, fontWeight: "600" }}>
        {location
          ? `${quality.label}${location.accuracy == null ? "" : ` · ±${location.accuracy.toFixed(1)} m`}`
          : "GPS não capturado"}
      </Text>
    </View>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 8, flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[
          s.input,
          multiline && { minHeight: 110, textAlignVertical: "top" },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#929B93"
        multiline={multiline}
        editable={!disabled}
        maxLength={multiline ? 3000 : 100}
      />
    </View>
  );
}
function VisitRow({ visit, onPress }: { visit: Visit; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir visita a ${visit.farm}`}
      onPress={onPress}
      style={({ pressed }) => [s.visitRow, pressed && { opacity: 0.7 }]}
    >
      <View style={s.visitIcon}>
        <Icon name="leaf-outline" />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={s.cardTitle}>{visit.farm}</Text>
        <Text style={s.small}>
          {visit.crop || "Cultura não informada"} · {date(visit.createdAt)}
        </Text>
        <GPSBadge location={visit.location} />
      </View>
      <Icon name="chevron-forward" size={18} color={C.muted} />
    </Pressable>
  );
}

function CampoApp() {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [tab, setTab] = useState<Tab>("home");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [busy, setBusy] = useState<"photo" | "gps" | "save" | null>(null);
  const [motion, setMotion] = useState({ g: 0, progress: 0 });
  const [detail, setDetail] = useState<Visit | null>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setVisits(await loadVisits());
      setHistoryError(false);
    } catch {
      setHistoryError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => controller.current?.abort();
  }, []);

  async function hardware(kind: "photo" | "gps") {
    if (lock.current) return;
    lock.current = true;
    setBusy(kind);
    try {
      if (kind === "photo") {
        const uri = await takePhoto();
        if (uri) setPhoto(uri);
      } else {
        const point = await captureLocation();
        if (point) setLocation(point);
      }
    } catch (error) {
      showAlert(
        kind === "photo" ? "Câmera indisponível" : "Localização indisponível",
        error instanceof Error
          ? error.message
          : "Não foi possível acessar o recurso. Verifique as permissões e tente novamente.",
      );
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function conclude() {
    if (lock.current) return;
    lock.current = true;
    setBusy("save");
    setMotion({ g: 0, progress: 0 });
    const abort = new AbortController();
    controller.current = abort;
    try {
      const peakG = await verifyMotion(abort.signal, (g, progress) =>
        setMotion({ g, progress }),
      );
      if (abort.signal.aborted) return;
      const visit: Visit = {
        ...form,
        farm: form.farm.trim(),
        technician: form.technician.trim(),
        crop: form.crop.trim(),
        notes: form.notes.trim(),
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        createdAt: new Date().toISOString(),
        photoUri: photo,
        location,
        peakG,
      };
      const next = await saveVisit(visit);
      setVisits(next);
      setForm(emptyForm);
      setPhoto(null);
      setLocation(null);
      setTab("history");
      showAlert(
        "Visita concluída",
        "O registro e suas evidências foram salvos neste dispositivo e podem ser consultados sem internet.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar. Seus dados continuam no formulário; tente novamente.";
      if (message === "Instabilidade Física Detectada")
        showAlert(
          message,
          "Foi detectada aceleração acima de 2,0g. A visita não foi concluída. Apoie o aparelho e tente novamente.",
        );
      else showAlert("Visita não concluída", message);
    } finally {
      controller.current = null;
      lock.current = false;
      setBusy(null);
    }
  }

  function requestConclusion() {
    if (lock.current) return;
    if (!form.farm.trim() || !form.technician.trim()) {
      showAlert(
        "Faltam informações",
        "Preencha a propriedade e o nome do responsável técnico.",
      );
      return;
    }
    if (!photo || !location) {
      showAlert(
        "Evidências incompletas",
        `Esta visita ficará sem ${[!photo && "foto", !location && "localização"].filter(Boolean).join(" e ")}. Deseja continuar?`,
        [
          { text: "Voltar", style: "cancel" },
          { text: "Continuar", onPress: () => void conclude() },
        ],
      );
    } else void conclude();
  }
  const update = (key: keyof typeof emptyForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const errorBanner = historyError ? (
    <View style={s.error}>
      <Text style={s.body}>
        Não foi possível ler o histórico. Seus dados foram preservados. A
        conclusão fica indisponível até a leitura ser recuperada.
      </Text>
      <Button
        title="Tentar novamente"
        secondary
        onPress={() => void refresh()}
      />
    </View>
  ) : null;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <View style={s.brandMark}>
          <Icon name="leaf" color="#fff" size={23} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.brand}>
            campo<Text style={{ color: C.orange }}>.</Text>
          </Text>
          <Text style={s.brandCaption}>REGISTRO DE VISITAS TÉCNICAS</Text>
        </View>
        <View style={s.localTag}>
          <Icon name="phone-portrait-outline" size={14} />
          <Text style={s.small}>Local</Text>
        </View>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {tab === "history" ? (
          <FlatList
            data={visits}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[s.content, { maxWidth: 1000 }]}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            ListHeaderComponent={
              <View style={{ gap: 16, marginBottom: 22 }}>
                <Text style={s.eyebrow}>SEU CADERNO DE CAMPO</Text>
                <Text style={s.title}>Histórico de visitas</Text>
                <Text style={s.body}>
                  Registros guardados no aparelho. Disponíveis também sem
                  conexão.
                </Text>
                {errorBanner}
                {loading && <ActivityIndicator color={C.green} />}
              </View>
            }
            renderItem={({ item }) => (
              <VisitRow visit={item} onPress={() => setDetail(item)} />
            )}
            ListEmptyComponent={
              !loading && !historyError ? (
                <View style={s.empty}>
                  <Icon name="journal-outline" size={40} />
                  <Text style={s.cardTitle}>
                    Uma nova história começa no campo
                  </Text>
                  <Text style={[s.body, { textAlign: "center" }]}>
                    Suas visitas concluídas aparecerão aqui.
                  </Text>
                  <Button
                    title="Registrar primeira visita"
                    icon="add"
                    onPress={() => setTab("new")}
                  />
                </View>
              ) : null
            }
          />
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {tab === "home" ? (
              <>
                <View style={s.intro}>
                  <Text style={s.eyebrow}>DO CAMPO PARA O SEU CADERNO</Text>
                  <Text style={s.title}>
                    Bom trabalho começa{wide ? " " : "\n"}com um bom registro.
                  </Text>
                  <Text style={s.body}>
                    Acompanhe suas visitas, reúna evidências e cuide de cada
                    detalhe da propriedade.
                  </Text>
                </View>
                {errorBanner}
                <View
                  style={[
                    s.hero,
                    wide && { flexDirection: "row", alignItems: "center" },
                  ]}
                >
                  <View style={{ flex: 1, gap: 16 }}>
                    <View style={s.heroBadge}>
                      <View style={[s.dot, { backgroundColor: C.lime }]} />
                      <Text
                        style={{
                          color: C.lime,
                          fontSize: 11,
                          fontWeight: "700",
                          letterSpacing: 1,
                        }}
                      >
                        PRONTO PARA O CAMPO
                      </Text>
                    </View>
                    <Text style={s.heroTitle}>
                      Cada visita,\num campo melhor.
                    </Text>
                    <Text style={s.heroBody}>
                      Da primeira foto à última observação.\nTudo o que importa,
                      em um só lugar.
                    </Text>
                    <View style={{ alignSelf: "flex-start" }}>
                      <Button
                        title="Nova visita técnica"
                        icon="add"
                        secondary
                        onPress={() => setTab("new")}
                      />
                    </View>
                  </View>
                  <View style={s.heroArt}>
                    <Icon name="leaf-outline" size={94} color={C.lime} />
                    <View style={s.artLine} />
                    <Text
                      style={{ color: C.lime, fontSize: 12, letterSpacing: 3 }}
                    >
                      OBSERVAR · REGISTRAR · CUIDAR
                    </Text>
                  </View>
                </View>
                <View style={s.stats}>
                  <View style={s.stat}>
                    <Icon name="clipboard-outline" />
                    <Text style={s.statNumber}>
                      {loading ? "—" : visits.length}
                    </Text>
                    <Text style={s.small}>visitas concluídas</Text>
                  </View>
                  <View style={s.stat}>
                    <Icon name="location-outline" />
                    <Text style={s.statNumber}>
                      {loading ? "—" : visits.filter((v) => v.location).length}
                    </Text>
                    <Text style={s.small}>com localização</Text>
                  </View>
                  <View style={s.stat}>
                    <Icon name="cloud-offline-outline" />
                    <Text style={s.statNumber}>Offline</Text>
                    <Text style={s.small}>histórico no aparelho</Text>
                  </View>
                </View>
                <View style={s.sectionHeading}>
                  <Text style={s.sectionTitle}>Últimas visitas</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setTab("history")}
                  >
                    <Text style={s.link}>Ver histórico →</Text>
                  </Pressable>
                </View>
                {visits.slice(0, 3).map((visit) => (
                  <VisitRow
                    key={visit.id}
                    visit={visit}
                    onPress={() => setDetail(visit)}
                  />
                ))}
                {!visits.length && (
                  <View style={s.empty}>
                    <Icon name="leaf-outline" size={30} />
                    <Text style={s.cardTitle}>
                      {loading
                        ? "Carregando registros…"
                        : "Seu próximo registro começa aqui"}
                    </Text>
                    <Text style={[s.body, { textAlign: "center" }]}>
                      Toque em Nova visita técnica para começar.
                    </Text>
                  </View>
                )}
                <View style={s.tip}>
                  <Icon name="shield-checkmark-outline" />
                  <Text style={[s.small, { flex: 1, lineHeight: 20 }]}>
                    Mais cuidado ao concluir: o sensor de movimento verifica a
                    estabilidade do aparelho antes de salvar a visita.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={s.intro}>
                  <Text style={s.eyebrow}>OBSERVE. REGISTRE. ACOMPANHE.</Text>
                  <Text style={s.title}>Nova visita técnica</Text>
                  <Text style={s.body}>
                    Preencha os dados e registre o que encontrou no campo.
                  </Text>
                </View>
                {errorBanner}
                <View style={s.card}>
                  <View style={s.sectionHeading}>
                    <Text style={s.sectionTitle}>01 · Dados da visita</Text>
                    <Icon name="clipboard-outline" />
                  </View>
                  <Text style={s.small}>* Campos obrigatórios</Text>
                  <View style={[s.fields, wide && { flexDirection: "row" }]}>
                    <Field
                      label="Propriedade *"
                      placeholder="Ex.: Fazenda Boa Vista"
                      value={form.farm}
                      onChange={(v) => update("farm", v)}
                      disabled={!!busy}
                    />
                    <Field
                      label="Responsável técnico *"
                      placeholder="Seu nome"
                      value={form.technician}
                      onChange={(v) => update("technician", v)}
                      disabled={!!busy}
                    />
                  </View>
                  <Field
                    label="Cultura / atividade"
                    placeholder="Ex.: Café, soja, horticultura…"
                    value={form.crop}
                    onChange={(v) => update("crop", v)}
                    disabled={!!busy}
                  />
                  <Text style={s.label}>Condição observada</Text>
                  <View style={s.chips}>
                    {(["Regular", "Atenção", "Crítico"] as const).map(
                      (item, i) => (
                        <Pressable
                          key={item}
                          accessibilityRole="radio"
                          accessibilityState={{
                            checked: form.condition === item,
                          }}
                          disabled={!!busy}
                          onPress={() => update("condition", item)}
                          style={[
                            s.chip,
                            form.condition === item && s.chipActive,
                          ]}
                        >
                          <View
                            style={[
                              s.dot,
                              {
                                backgroundColor: [
                                  "#528A51",
                                  "#C79327",
                                  "#BA5545",
                                ][i],
                              },
                            ]}
                          />
                          <Text
                            style={[
                              s.small,
                              form.condition === item && {
                                color: C.green,
                                fontWeight: "700",
                              },
                            ]}
                          >
                            {item}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                  <Field
                    label="Observações"
                    placeholder="Condições da lavoura, orientações e próximos passos…"
                    value={form.notes}
                    onChange={(v) => update("notes", v)}
                    multiline
                    disabled={!!busy}
                  />
                </View>
                <View style={s.card}>
                  <Text style={s.sectionTitle}>02 · Evidências do campo</Text>
                  <Text style={s.body}>
                    Foto e GPS são recomendados. Se um recurso estiver
                    indisponível, você pode registrar a visita sem ele.
                  </Text>
                  <View style={[s.fields, wide && { flexDirection: "row" }]}>
                    <View style={s.evidence}>
                      {photo ? (
                        <Image
                          source={{ uri: photo }}
                          style={s.photo}
                          accessibilityLabel="Foto capturada nesta visita"
                        />
                      ) : (
                        <View style={s.photoPlaceholder}>
                          <Icon name="camera-outline" size={35} />
                          <Text style={s.small}>
                            Uma imagem conta parte da história
                          </Text>
                        </View>
                      )}
                      <Button
                        title={
                          busy === "photo"
                            ? "Abrindo câmera…"
                            : photo
                              ? "Refazer foto"
                              : "Fotografar"
                        }
                        icon="camera-outline"
                        secondary
                        disabled={!!busy}
                        onPress={() => void hardware("photo")}
                      />
                    </View>
                    <View style={[s.evidence, s.gpsPanel]}>
                      <Icon name="locate-outline" size={34} />
                      <Text style={s.cardTitle}>Localização da visita</Text>
                      <GPSBadge location={location} />
                      <Text
                        style={[
                          s.small,
                          { textAlign: "center", lineHeight: 20 },
                        ]}
                      >
                        {location
                          ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}\nCapturada às ${new Date(location.capturedAt).toLocaleTimeString("pt-BR")}`
                          : "Capture o ponto onde você está.\nA cor indica a precisão da leitura."}
                      </Text>
                      <View style={{ alignSelf: "stretch", marginTop: "auto" }}>
                        <Button
                          title={
                            busy === "gps"
                              ? "Buscando localização…"
                              : location
                                ? "Atualizar GPS"
                                : "Capturar GPS"
                          }
                          icon="navigate-outline"
                          secondary
                          disabled={!!busy}
                          onPress={() => void hardware("gps")}
                        />
                      </View>
                    </View>
                  </View>
                </View>
                <View style={[s.card, { backgroundColor: "#EDF2E6" }]}>
                  <View style={s.sectionHeading}>
                    <Text style={s.sectionTitle}>03 · Conclusão segura</Text>
                    <Icon name="shield-checkmark-outline" />
                  </View>
                  <Text style={s.body}>
                    Ao concluir, mantenha o aparelho estável por 3 segundos.
                    Movimentos acima de 2,0g bloqueiam o fechamento.
                  </Text>
                  {busy === "save" && (
                    <View accessibilityLiveRegion="polite" style={{ gap: 10 }}>
                      <Text style={s.label}>
                        Verificando estabilidade · {motion.g.toFixed(2)}g
                      </Text>
                      <View style={s.progressTrack}>
                        <View
                          style={[
                            s.progressFill,
                            { width: `${motion.progress * 100}%` },
                          ]}
                        />
                      </View>
                      <Text style={s.small}>
                        Mantenha o aplicativo aberto até a confirmação.
                      </Text>
                    </View>
                  )}
                  <Button
                    title={
                      busy === "save"
                        ? "Verificando e salvando…"
                        : "Concluir e salvar visita"
                    }
                    icon="checkmark-circle-outline"
                    disabled={!!busy || loading || historyError}
                    onPress={requestConclusion}
                  />
                  <Text style={[s.small, { textAlign: "center" }]}>
                    Salvo apenas neste dispositivo · Sem envio a servidores
                  </Text>
                </View>
              </>
            )}
            <Text style={s.footer}>
              CAMPO · TECNOLOGIA A SERVIÇO DE QUEM CULTIVA
            </Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <View style={s.nav}>
        {(
          [
            { key: "home", label: "Início", icon: "grid-outline" },
            { key: "new", label: "Nova visita", icon: "add-circle-outline" },
            { key: "history", label: "Histórico", icon: "time-outline" },
          ] as { key: Tab; label: string; icon: IconName }[]
        ).map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{
              selected: tab === item.key,
              disabled: !!busy,
            }}
            disabled={!!busy}
            onPress={() => setTab(item.key)}
            style={[s.navItem, tab === item.key && s.navActive]}
          >
            <Icon
              name={item.icon}
              color={tab === item.key ? C.green : C.muted}
            />
            <Text style={[s.navLabel, tab === item.key && { color: C.green }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Modal
        visible={detail !== null}
        animationType="slide"
        onRequestClose={() => setDetail(null)}
      >
        <SafeAreaView style={s.safe}>
          {detail && (
            <ScrollView contentContainerStyle={[s.content, { maxWidth: 850 }]}>
              <Button
                title="Voltar ao histórico"
                icon="arrow-back"
                secondary
                onPress={() => setDetail(null)}
              />
              <Text style={s.eyebrow}>
                VISITA CONCLUÍDA · {date(detail.createdAt)}
              </Text>
              <Text style={s.title}>{detail.farm}</Text>
              <View style={s.card}>
                <Text style={s.cardTitle}>Informações da visita</Text>
                <Text style={s.body}>Responsável: {detail.technician}</Text>
                <Text style={s.body}>
                  Cultura: {detail.crop || "Não informada"}
                </Text>
                <Text style={s.body}>Condição: {detail.condition}</Text>
                <Text style={s.body}>
                  {detail.notes || "Sem observações adicionais."}
                </Text>
              </View>
              {detail.photoUri ? (
                <SavedPhoto uri={detail.photoUri} />
              ) : (
                <Text style={s.body}>Visita registrada sem foto.</Text>
              )}
              <View style={s.card}>
                <Text style={s.cardTitle}>Localização e estabilidade</Text>
                <GPSBadge location={detail.location} />
                {detail.location && (
                  <Text selectable style={s.body}>
                    {detail.location.latitude.toFixed(6)},{" "}
                    {detail.location.longitude.toFixed(6)}
                  </Text>
                )}
                <Text style={s.body}>
                  Pico na verificação: {detail.peakG.toFixed(2)}g
                </Text>
                <Text style={s.small}>
                  Registro local ·{" "}
                  {new Date(detail.createdAt).toLocaleString("pt-BR")}
                </Text>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function SavedPhoto({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <Text style={s.body}>
      A foto deste registro não está mais disponível no dispositivo.
    </Text>
  ) : (
    <Image
      source={{ uri }}
      style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 18 }}
      resizeMode="contain"
      onError={() => setFailed(true)}
      accessibilityLabel="Evidência fotográfica da visita concluída"
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <CampoApp />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: C.line,
    backgroundColor: "#FFF",
  },
  brandMark: {
    width: 43,
    height: 43,
    backgroundColor: C.green,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontSize: 29,
    fontWeight: "800",
    color: C.green,
    letterSpacing: -1.5,
  },
  brandCaption: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: C.muted,
    marginTop: 2,
  },
  localTag: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    backgroundColor: C.paper,
    padding: 8,
    borderRadius: 10,
  },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    padding: 20,
    gap: 20,
    paddingBottom: 32,
  },
  intro: { gap: 12, paddingTop: 10, paddingBottom: 4 },
  eyebrow: {
    color: C.orange,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  title: {
    color: C.ink,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  body: { color: C.muted, fontSize: 14, lineHeight: 22 },
  small: { color: C.muted, fontSize: 12 },
  hero: {
    borderRadius: 24,
    padding: 26,
    backgroundColor: C.green,
    gap: 26,
    overflow: "hidden",
  },
  heroBadge: { flexDirection: "row", gap: 7, alignItems: "center" },
  heroTitle: {
    color: "#F7F8EB",
    fontSize: 37,
    fontWeight: "600",
    letterSpacing: -1.4,
    lineHeight: 43,
  },
  heroBody: { color: "#C7D6C5", fontSize: 14, lineHeight: 22 },
  heroArt: {
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    padding: 15,
  },
  artLine: { height: 1, width: 140, backgroundColor: "#6B8660" },
  button: {
    minHeight: 49,
    paddingHorizontal: 17,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: C.green,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  secondary: {
    backgroundColor: "#F1F5E9",
    borderWidth: 1,
    borderColor: "#D9E3CF",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "center",
  },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    flex: 1,
    minWidth: 90,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 15,
    gap: 9,
  },
  statNumber: { color: C.ink, fontSize: 24, fontWeight: "700" },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  sectionTitle: {
    color: C.ink,
    fontSize: 18,
    fontWeight: "600",
    flexShrink: 1,
  },
  cardTitle: { color: C.ink, fontSize: 15, fontWeight: "600" },
  link: {
    fontSize: 12,
    fontWeight: "600",
    color: C.green,
    paddingVertical: 10,
  },
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#FFF",
    marginBottom: 10,
  },
  visitIcon: { padding: 12, backgroundColor: "#EFF3E6", borderRadius: 14 },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 15,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CAD6BF",
    borderRadius: 20,
  },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 17,
    backgroundColor: "#ECF0E5",
    borderRadius: 14,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: C.line,
    gap: 18,
  },
  fields: { gap: 18 },
  label: { fontSize: 13, color: C.ink, fontWeight: "600" },
  input: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: "#DBE1D7",
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: C.ink,
    backgroundColor: "#FCFCF9",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    padding: 12,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipActive: { backgroundColor: "#EEF4E7", borderColor: C.green },
  evidence: { flex: 1, gap: 12, minWidth: 0 },
  photo: { width: "100%", height: 180, borderRadius: 12 },
  photoPlaceholder: {
    height: 180,
    backgroundColor: "#F6F7F1",
    borderWidth: 1,
    borderColor: C.line,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 12,
  },
  gpsPanel: {
    alignItems: "center",
    backgroundColor: "#F7F8F3",
    padding: 16,
    borderRadius: 12,
    gap: 13,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D4DFC9",
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: C.green },
  footer: {
    textAlign: "center",
    color: "#93A08E",
    fontSize: 8,
    letterSpacing: 1.5,
    marginTop: 10,
  },
  nav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: "#FFF",
    paddingVertical: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
    gap: 8,
  },
  navItem: {
    flex: 1,
    maxWidth: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 9,
    borderRadius: 12,
  },
  navActive: { backgroundColor: "#EDF3E6" },
  navLabel: { color: C.muted, fontSize: 11, fontWeight: "600" },
  error: { backgroundColor: "#FFF0E8", borderRadius: 12, padding: 16, gap: 12 },
});
