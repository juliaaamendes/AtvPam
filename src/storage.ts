import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { parseVisits, Visit } from "./domain";

const KEY = "@campo/visits/v1";
export async function loadVisits(): Promise<Visit[]> {
  return parseVisits(await AsyncStorage.getItem(KEY));
}

export async function saveVisit(visit: Visit): Promise<Visit[]> {
  // Read first: a damaged or unreadable history must never be overwritten.
  const previous = await loadVisits();
  if (previous.some((item) => item.id === visit.id)) return previous;
  let photo: File | undefined;
  try {
    if (visit.photoUri) {
      const directory = new Directory(Paths.document, "visits");
      directory.create({ idempotent: true, intermediates: true });
      photo = new File(directory, `${visit.id}.jpg`);
      new File(visit.photoUri).copy(photo);
    }
    const next = [{ ...visit, photoUri: photo?.uri ?? null }, ...previous];
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch (error) {
    // Roll back the new image if the record could not be committed.
    try {
      if (photo?.exists) photo.delete();
    } catch {
      /* Preserve the original error. */
    }
    throw new Error(
      "Não foi possível gravar a visita no aparelho. Verifique o espaço de armazenamento e tente novamente. O formulário foi mantido.",
      { cause: error },
    );
  }
}
