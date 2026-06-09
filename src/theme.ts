import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f2fbf8",
      paper: "rgba(252, 255, 253, 0.96)",
    },
    primary: {
      main: "#3aa99e",
      light: "#dff7f2",
      dark: "#23746f",
    },
    secondary: {
      main: "#69aee8",
    },
    text: {
      primary: "#183139",
      secondary: "#668086",
    },
    divider: "#d8ece8",
    warning: {
      main: "#9a6a12",
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
          backgroundColor: "#f2fbf8",
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
