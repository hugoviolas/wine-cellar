export interface ToastContextValue {
  success: (text: string) => void;
  error: (text: string) => void;
}
