import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f6f4ef",
      paper: "#fdfcfa",
    },
    primary: {
      main: "#4f8a78",
      light: "#e7efe9",
      dark: "#3a6657",
    },
    secondary: {
      main: "#b08642",
    },
    text: {
      primary: "#2b2820",
      secondary: "#8d8678",
    },
    divider: "#e8e3d9",
    warning: {
      main: "#9a6a12",
    },
  },
  shape: {
    borderRadius: 6,
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
          backgroundColor: "#f6f4ef",
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
          minHeight: 36,
          borderRadius: 6,
        },
      },
    },
  },
});
