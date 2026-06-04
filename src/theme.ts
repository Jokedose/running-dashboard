import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f5f6f1",
      paper: "rgba(255, 255, 255, 0.94)",
    },
    primary: {
      main: "#2a7f62",
      light: "#d8eee5",
      dark: "#1f664e",
    },
    secondary: {
      main: "#cf244f",
    },
    text: {
      primary: "#172026",
      secondary: "#657176",
    },
    divider: "#dde4df",
    warning: {
      main: "#7d4e00",
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: {
      fontWeight: 750,
      textTransform: "none",
    },
    h1: {
      letterSpacing: 0,
      fontWeight: 750,
    },
    h2: {
      letterSpacing: 0,
      fontWeight: 750,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#f5f6f1",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: 42,
          borderRadius: 8,
        },
      },
    },
  },
});
