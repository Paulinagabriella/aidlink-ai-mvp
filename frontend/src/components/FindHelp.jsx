import { useEffect, useState } from "react";
import {
  Box, Button, Select, Text, VStack, HStack, Badge, Spinner
} from "@chakra-ui/react";

import { API } from "../lib/api";

export default function FindHelp() {
  const [loc, setLoc] = useState(null);
  const [locErr, setLocErr] = useState("");
  const [category, setCategory] = useState("water");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  // Ask for geolocation
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocErr("Geolocation not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocErr("");
      },
      (err) => {
        setLocErr(err.message || "Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  async function findNearest() {
    if (!loc) {
      alert("Waiting for your location…");
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const url = `${API}/nearest-orgs?lat=${loc.lat}&lng=${loc.lng}&category=${encodeURIComponent(category)}&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch nearest locations.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box borderWidth="1px" p={3} borderRadius="lg">
      <Text fontWeight="bold" mb={2}>Find Help Near Me</Text>

      <VStack align="stretch" gap={2}>
        <HStack justify="space-between">
          <Box>
            <Text fontSize="sm" color="gray.600">Your location</Text>
            {loc ? (
              <Badge>
                {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
              </Badge>
            ) : locErr ? (
              <Text color="red.500" fontSize="sm">{locErr}</Text>
            ) : (
              <HStack><Spinner size="xs" /><Text fontSize="sm">Getting location…</Text></HStack>
            )}
          </Box>

          <Select value={category} onChange={(e) => setCategory(e.target.value)} width="150px">
            <option value="food">Food</option>
            <option value="water">Water</option>
            <option value="shelter">Shelter</option>
            <option value="medical">Medical</option>
          </Select>
        </HStack>

        <Button onClick={findNearest} isDisabled={!loc} colorScheme="blue">
          Find nearest
        </Button>

        {results.length > 0 && (
          <VStack align="stretch" gap={2} mt={2}>
            {results.map((r, i) => {
              const o = r.org;
              const gmaps = `https://www.google.com/maps?q=${o.location.lat},${o.location.lng}`;
              return (
                <Box key={o.id} borderWidth="1px" p={3} borderRadius="md">
                  <Text fontWeight="bold">{i + 1}. {o.name}</Text>
                  <Text fontSize="sm">Distance: <b>{r.km} km</b></Text>
                  <Text fontSize="sm">Categories: {o.categories.join(", ")}</Text>
                  <a href={gmaps} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
                    Open in Google Maps
                  </a>
                </Box>
              );
            })}
          </VStack>
        )}

        {loading && <Spinner />}
      </VStack>
    </Box>
  );
}
