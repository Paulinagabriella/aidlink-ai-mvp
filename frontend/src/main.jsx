import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  ChakraProvider, Box, Heading, Grid, GridItem, VStack, Text, Button, HStack, Badge,
} from "@chakra-ui/react";

import NeedForm from "./components/NeedForm.jsx";
import MapView from "./components/MapView.jsx";

const API = `http://${window.location.hostname}:8000`;

function App() {
  const [needs, setNeeds] = useState([]);
  const [error, setError] = useState("");
  const [userLoc, setUserLoc] = useState(null);
  const [locErr, setLocErr] = useState("");
  const [highlights, setHighlights] = useState([]);         // nearest orgs (stars)
  const [highlightCategory, setHighlightCategory] = useState(null);

  // load existing needs
  const loadNeeds = () => {
    fetch(`${API}/needs`)
      .then((r) => {
        if (!r.ok) throw new Error("Backend not reachable");
        return r.json();
      })
      .then((data) => { setNeeds(data); setError(""); })
      .catch((e) => setError(e.message));
  };
  useEffect(loadNeeds, []);

  // get user location
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocErr("Geolocation not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocErr(""); },
      (err) => setLocErr(err.message || "Location permission denied."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // after creating a need: reload list + compute nearest orgs for its category
  async function handleCreated(_newItem, category) {
    loadNeeds();
    if (!userLoc) return;
    try {
      const url = `${API}/nearest-orgs?lat=${userLoc.lat}&lng=${userLoc.lng}&category=${encodeURIComponent(category)}&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      setHighlights(data);
      setHighlightCategory(category);
    } catch (e) {
      console.error(e);
    }
  }

  // delete + clear stars if category matches currently highlighted category
  async function handleDelete(id, title) {
    const ok = confirm(`Delete "${title}"?`);
    if (!ok) return;
    const needToDelete = needs.find((n) => n.id === id);
    try {
      const res = await fetch(`${API}/needs/${id}`, { method: "DELETE" });
      if (res.ok) {
        setNeeds((prev) => prev.filter((n) => n.id !== id));
        if (
          needToDelete &&
          needToDelete.category.toLowerCase() === (highlightCategory || "").toLowerCase()
        ) {
          setHighlights([]);
          setHighlightCategory(null);
        }
      } else {
        alert("Failed to delete item");
      }
    } catch (e) {
      console.error(e);
      alert("Network error while deleting");
    }
  }

  return (
    <ChakraProvider>
      <Box p={6} maxW="1200px" mx="auto">
        <Heading mb={4}>AidLink AI</Heading>

        {error && (
          <Box mb={3} color="red" fontWeight="bold">
            Failed to fetch — Is the backend running on port 8000? ({error})
          </Box>
        )}

        <HStack mb={3} spacing={4}>
          <Box>
            <Text fontSize="sm" color="gray.600">Your location</Text>
            {userLoc ? (
              <Badge>{userLoc.lat.toFixed(4)}, {userLoc.lng.toFixed(4)}</Badge>
            ) : locErr ? (
              <Text color="red.500" fontSize="sm">{locErr}</Text>
            ) : (
              <Text fontSize="sm">Requesting location…</Text>
            )}
          </Box>
          <Button
            size="sm"
            onClick={() => {
              if (!("geolocation" in navigator)) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocErr(""); },
                (err) => setLocErr(err.message || "Location permission denied.")
              );
            }}
          >
            Refresh location
          </Button>
        </HStack>

        <Grid templateColumns={{ base: "1fr", md: "360px 1fr" }} gap={4}>
          <GridItem>
            <Box borderWidth="1px" p={3} borderRadius="lg" mb={4}>
              <Heading size="md" mb={2}>Post a Need (auto-finds nearest)</Heading>
              <NeedForm onCreated={handleCreated} userLoc={userLoc} />
            </Box>

            <Box borderWidth="1px" p={3} borderRadius="lg" mb={4}>
              <Heading size="md" mb={2}>Nearest Help for Your Need</Heading>
              <VStack align="stretch" gap={2}>
                {highlights.length === 0 && (
                  <Text fontSize="sm" color="gray.600">
                    Submit a need (with category) to see the closest places here.
                  </Text>
                )}
                {highlights.map((h, i) => {
                  const o = h.org;
                  const gmaps = `https://www.google.com/maps?q=${o.location.lat},${o.location.lng}`;
                  return (
                    <Box key={o.id} borderWidth="1px" p={3} borderRadius="md">
                      <Text fontWeight="bold">{i + 1}. {o.name}</Text>
                      <Text fontSize="sm">Distance: <b>{h.km} km</b></Text>
                      <Text fontSize="sm">Categories: {o.categories.join(", ")}</Text>
                      <a href={gmaps} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
                        Open in Google Maps
                      </a>
                    </Box>
                  );
                })}
              </VStack>
            </Box>

            <Box borderWidth="1px" p={3} borderRadius="lg">
              <Heading size="md" mb={2}>Needs</Heading>
              <VStack align="stretch" gap={2}>
                {needs.map((n) => (
                  <Box
                    key={n.id}
                    borderWidth="1px"
                    p={3}
                    borderRadius="lg"
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    gap={3}
                  >
                    <Box>
                      <Text fontWeight="bold">{n.title}</Text>
                      <Text>Category: {n.category}</Text>
                      <Text>Severity: {n.severity}</Text>
                      <Text fontSize="sm" color="gray.600">
                        Pop density: {n.population_density} • Available aid nearby: {n.available_aid}
                      </Text>
                    </Box>
                    <Button size="sm" colorScheme="red" onClick={() => handleDelete(n.id, n.title)}>
                      Delete
                    </Button>
                  </Box>
                ))}
                {needs.length === 0 && <Text>No needs yet.</Text>}
              </VStack>
            </Box>
          </GridItem>

          <GridItem>
            <MapView needs={needs} highlights={highlights} userLoc={userLoc} />
          </GridItem>
        </Grid>
      </Box>
    </ChakraProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
