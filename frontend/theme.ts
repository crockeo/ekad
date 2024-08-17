interface Colors {
  text: string;
}

interface Theme {
  colors: Colors,
}

export default function useTheme(): Theme {
  return {
    colors: {
      text: "#333333",
    },
  };
}
