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
  Button,
} from "@chakra-ui/react";

import { API, getJson } from "./lib/api";
import NeedForm from "./components/NeedForm.jsx";
import MapView from "./components/MapView.jsx";
import SearchForm from "./components/SearchForm.jsx";
import ResultsList from "./components/ResultsList.jsx";
import UiControls from "./components/UiControls.jsx";

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

const theme = extendTheme({
  styles: {
    global: {
      "html, body, #root": { height: "100%" },
      body: {
        fontSize: "clamp(14px, calc(14px * var(--font-scale, 1)), 20px)",
      },
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

  const [priorities, setPriorities] = useState({
    top_regions: [],
  });
  const [prioLoading, setPrioLoading] = useState(false);

  const loadNeeds = async () => {
    try {
      const data = await getJson(`${API}/needs`);
      setNeeds(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to fetch backend data.");
    }
  };

  const refreshPriorities = async () => {
    try {
      setPrioLoading(true);
      const d = await getJson(`${API}/priorities`);
      setPriorities(d || { top_regions: [] });
    } catch (e) {
      console.error(e);
      setPriorities({ top_regions: [] });
    } finally {
      setPrioLoading(false);
    }
  };

  useEffect(() => {
    loadNeeds();
    refreshPriorities();
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceLoc({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        console.warn("Geolocation denied:", err);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
  }, [fontScale]);

  async function handleDelete(id, title) {
    const ok = confirm(`Delete "${title}"?`);
    if (!ok) return;

    try {
      const res = await fetch(`${API}/needs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to delete item");
      }
      await loadNeeds();
      await refreshPriorities();
    } catch (e) {
      console.error(e);
      alert("Failed to delete item.");
    }
  }

  const onNeedCreated = async () => {
    await loadNeeds();
    await refreshPriorities();
  };

  return (
    <ChakraProvider theme={theme}>
      <ColorModeScript />
      <Box p={6} maxW="1400px" mx="auto">
        <HStack justify="space-between" align="center" mb={4}>
          <Heading>AidLink AI</Heading>
          <UiControls fontScale={fontScale} setFontScale={setFontScale} />
        </HStack>

        {error && (
          <Box mb={3} color="red.500" fontWeight="bold" role="alert">
            Failed to fetch backend data. ({error})
          </Box>
        )}

        <Grid templateColumns={{ base: "1fr", lg: "360px 1fr" }} gap={4}>
          <GridItem>
            <VStack align="stretch" spacing={4}>
              <Box borderWidth="1px" p={3} borderRadius="lg">
                <Heading size="md" mb={2}>
                  I need help / Find donation locations
                </Heading>
                <SearchForm
                  setResults={setResults}
                  setSearchLoc={setSearchLoc}
                  deviceLoc={deviceLoc}
                />
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
                        Category: {n.category} • Severity: {n.severity}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        Lat: {n.location?.lat}, Lng: {n.location?.lng}
                      </Text>
                      <Button
                        mt={2}
                        size="sm"
                        colorScheme="red"
                        onClick={() => handleDelete(n.id, n.title)}
                      >
                        Delete
                      </Button>
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
                  Clustered priority regions returned by the backend.
                </Text>

                <Button size="sm" onClick={refreshPriorities}>
                  Refresh
                </Button>

                {prioLoading && (
                  <HStack mt={2}>
                    <Spinner size="sm" />
                    <Text>Loading…</Text>
                  </HStack>
                )}

                {!prioLoading && (
                  <>
                    <Heading size="sm" mt={3} mb={2}>
                      Top Regions
                    </Heading>
                    <VStack align="stretch" spacing={2}>
                      {(priorities.top_regions || []).map((r, i) => (
                        <Box key={`region-${i}`} borderWidth="1px" p={2} borderRadius="md">
                          <Text fontWeight="bold">Region {i + 1}</Text>
                          <Text fontSize="sm">Count: {r.count ?? "—"}</Text>
                          <Text fontSize="sm">
                            Center: {r.center?.lat ?? "—"}, {r.center?.lng ?? "—"}
                          </Text>
                          {typeof r.avg_risk !== "undefined" && (
                            <Text fontSize="sm">
                              Avg risk: <Badge colorScheme="purple">{r.avg_risk}</Badge>
                            </Text>
                          )}
                        </Box>
                      ))}
                      {(priorities.top_regions || []).length === 0 && (
                        <Text>No priority regions yet.</Text>
                      )}
                    </VStack>

                    <Divider my={3} />

                    <ResultsList items={results} />
                  </>
                )}
              </Box>
            </VStack>
          </GridItem>

          <GridItem>
            <MapView
              needs={needs}
              results={results}
              userLoc={searchLoc || deviceLoc}
            />
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