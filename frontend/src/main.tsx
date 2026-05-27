import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { AuthProvider } from "./auth/AuthContext";
import App from "./App";

const theme = createTheme({
  palette: {
    primary: { main: "#123b63" },
    secondary: { main: "#c68b17" },
    background: { default: "#f3f6f9" }
  },
  typography: { fontFamily: "Inter, Segoe UI, Arial, sans-serif" },
  components: { MuiCard: { styleOverrides: { root: { borderRadius: 12 } } } }
});
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15000 } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider><App /></AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);
