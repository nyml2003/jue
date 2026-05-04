declare namespace JSX {
  interface Element {}

  interface IntrinsicElements {
    View: Record<string, unknown>;
    Text: Record<string, unknown>;
    Button: Record<string, unknown>;
    Input: Record<string, unknown>;
    Image: Record<string, unknown>;
    ScrollView: Record<string, unknown>;
  }
}

export {};
