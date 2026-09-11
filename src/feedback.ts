import { Alert, Platform } from "react-native";

// React Native Web does not implement Alert.alert. Keep the preview informative.
export const showAlert: typeof Alert.alert = (
  title,
  message,
  buttons,
  options,
) => {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons, options);
    return;
  }
  const text = [title, message].filter(Boolean).join("\n\n");
  if (buttons && buttons.length > 1) {
    const proceed = buttons.find((button) => button.style !== "cancel");
    if (window.confirm(text)) proceed?.onPress?.();
    else buttons.find((button) => button.style === "cancel")?.onPress?.();
  } else {
    window.alert(text);
    buttons?.[0]?.onPress?.();
  }
};
