import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  ChakraProvider,
  extendTheme,
  ColorModeScript,
  Box,
  Heading,
  Grid,
  GridItem,
  VStack,
  Text,
  HStack,
  Badge,
  Spinner,
  Divider,
} from "@chakra-ui/react";

import NeedForm from "./components/NeedForm.jsx";
import MapView from "./components/MapView.jsx";
import SearchForm from "./components/SearchForm.jsx";
import ResultsList from "./components/ResultsList.jsx";
import UiControls from "./components/UiControls.jsx";

const API =
  import.meta.env.VITE_API_URL || "https://aidlink-ai-mvp-backend.onrender.com";

// ----- Error Boundary so a crash doesn't leave a blank page -----
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(error) {
    return { err: error };
  }
  componentDidCatch(error, info) {
    console.error("App crash:", error, info);
  }
  render() {
    if (this.state.err) {
      return (
        <Box p={6} color="red.500">
          <Heading size="md" mb={3}>
            Something went wrong
          </Heading>
          <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.err)}</pre>
          <Text mt={2} fontSize="sm" color="gray.600">
            Check the browser console for details.
          </Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

// safer JSON fetch
async function getJson(url) {
  const res = await fetch(url);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 160)}`);
  }
  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Expected JSON, got ${ct}. First bytes: ${txt.slice(0, 80)}`);
  }
  return res.json();
}

// Accessible base theme, font-size scales via CSS var
const theme = extendTheme({
  styles: {
    global: {
      "html, body, #root": { height: "100%" },
      body: { fontSize: "clamp(14px, calc(14px * var(--font-scale, 1)), 20px)" },
    },
  },
});

function App() {
  const [needs, setNeeds] = useState([]);
  const [error, setError] = useState("");
  const [deviceLoc, setDeviceLoc] = useState(null);
  const [searchLoc, setSearchLoc] = useState(null);
  const [results, setResults] = useState([]);
  const [fontScale, setFontScale] = useState(1.0);

  const [priorities, setPriorities] = useState({ top_needs: [], hotspots: [], explain: "" });
  const [prioLoading, setPrioLoading] = useState(false);

  // load needs
  const loadNeeds = () => {
    getJson(`${API}/needs`)
      .then((data) => {
        setNeeds(data);
        setError("");
      })
      .catch((e) => setError(e.message));
  };
  useEffect(loadNeeds, []);

  // geolocation
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setDeviceLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.warn("Geolocation denied:", err),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // priorities (AI)
  const refreshPriorities = async () => {
    try {
      setPrioLoading(true);
      const d = await getJson(`${API}/priorities`);
      setPriorities(d);
    } catch (e) {
      setPriorities({ top_needs: [], hotspots: [], explain: "Failed to load priorities." });
    } finally {
      setPrioLoading(false);
    }
  };
  useEffect(() => {
    refreshPriorities();
  }, []);

  // delete need
  async function handleDelete(id, title) {
    const ok = confirm(`Delete "${title}"?`);
    if (!ok) return;
    try {
      const res = await fetch(`${API}/needs/${id}`, { method: "DELETE" });
      if (res.ok) {
        setNeeds((prev) => prev.filter((n) => n.id !== id));
        refreshPriorities();
      } else {
        alert("Failed to delete item");
      }
    } catch {
      alert("Network error while deleting");
    }
  }

  // after create
  const onNeedCreated = () => {
    loadNeeds();
    refreshPriorities();
  };

  // apply font scale
  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
  }, [fontScale]);

  return (
    <ChakraProvider theme={theme}>
      <ColorModeScript />
      <Box p={6} maxW="1200px" mx="auto">
        <HStack justify="space-between" align="center" mb={4}>
          <Heading>AidLink AI</Heading>
          <UiControls fontScale={fontScale} setFontScale={setFontScale} />
        </HStack>

        {error && (
          <Box mb={3} color="red.500" fontWeight="bold" role="alert">
            Failed to fetch — Is the backend running on port 8000? ({error})
          </Box>
        )}

        <Grid templateColumns={{ base: "1fr", lg: "360px 1fr" }} gap={4}>
          <GridItem>
            <VStack align="stretch" spacing={4}>
              <Box borderWidth="1px" p={3} borderRadius="lg">
                <Heading size="md" mb={2}>
                  I need help / Find donation locations
                </Heading>
                <SearchForm setResults={setResults} setSearchLoc={setSearchLoc} deviceLoc={deviceLoc} />
              </Box>

              <Box borderWidth="1px" p={3} borderRadius="lg">
                <Heading size="md" mb={2}>
                  Post a Need
                </Heading>
                <NeedForm onCreated={onNeedCreated} userLoc={deviceLoc} />
                <VStack align="stretch" spacing={2} mt={3}>
                  {needs.map((n) => (
                    <Box key={n.id} borderWidth="1px" p={2} borderRadius="md">
                      <Text fontWeight="bold">{n.title}</Text>
                      <Text fontSize="sm" color="gray.600">
                        Categories: {(n.categories || []).join(", ")} • Severity: {n.severity}
                      </Text>
                      <button style={{ marginTop: 6 }} onClick={() => handleDelete(n.id, n.title)}>
                        Delete
                      </button>
                    </Box>
                  ))}
                  {needs.length === 0 && <Text>No needs yet.</Text>}
                </VStack>
              </Box>

              <Box borderWidth="1px" p={3} borderRadius="lg">
                <Heading size="md" mb={2}>
                  Priorities (AI)
                </Heading>
                <Text fontSize="sm" color="gray.600" mb={2}>
                  {priorities.explain || "Higher risk combines density, severity, and low nearby aid."}
                </Text>
                <button onClick={refreshPriorities}>Refresh</button>
                {prioLoading && (
                  <HStack mt={2}>
                    <Spinner size="sm" />
                    <Text>Loading…</Text>
                  </HStack>
                )}
                {!prioLoading && (
                  <>
                    <Heading size="sm" mt={2} mb={1}>
                      Top needs
                    </Heading>
                    <VStack align="stretch" spacing={2}>
                      {(priorities.top_needs || []).map((t) => (
                        <Box key={t.id} borderWidth="1px" p={2} borderRadius="md">
                          <Text fontWeight="bold">{t.title}</Text>
                          <Text>
                            Risk: <Badge colorScheme="red">{t.risk}</Badge>
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            {t.explain}
                          </Text>
                          <a
                            href={`https://www.google.com/maps?q=${t.location.lat},${t.location.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#3182ce" }}
                          >
                            Open in Google Maps
                          </a>
                        </Box>
                      ))}
                      {(priorities.top_needs || []).length === 0 && <Text>No needs yet.</Text>}
                    </VStack>

                    <Divider my={3} />

                    <Heading size="sm" mt={2} mb={1}>
                      Hotspots
                    </Heading>
                    <VStack align="stretch" spacing={2}>
                      {(priorities.hotspots || []).map((h, i) => (
                        <Box key={`hs-${i}`} borderWidth="1px" p={2} borderRadius="md">
                          <Text>
                            Avg risk: <Badge colorScheme="purple">{h.avg_risk}</Badge> • Items: {h.count}
                          </Text>
                          <a
                            href={`https://www.google.com/maps?q=${h.center.lat},${h.center.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#3182ce" }}
                          >
                            Open hotspot center in Google Maps
                          </a>
                        </Box>
                      ))}
                      {(priorities.hotspots || []).length === 0 && <Text>No hotspots yet.</Text>}
                    </VStack>
                  </>
                )}
              </Box>

              <ResultsList items={results} />
            </VStack>
          </GridItem>

          <GridItem>
            <MapView results={results} userLoc={searchLoc || deviceLoc} />
          </GridItem>
        </Grid>
      </Box>
    </ChakraProvider>
  );
}

function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
