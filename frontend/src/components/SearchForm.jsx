import React, { useMemo, useState } from "react";
import { Box, Button, FormControl, FormLabel, HStack, Input, Text, VStack } from "@chakra-ui/react";

const API = "/api";

// small helper
async function getJson(url) {
  const res = await fetch(url);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Expected JSON, got ${ct}. First bytes: ${txt.slice(0, 120)}`);
  }
  return res.json();
}

export default function SearchForm({ setResults, setSearchLoc, deviceLoc }) {
  const [needQuery, setNeedQuery] = useState("");
  const [whereQuery, setWhereQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const hasDeviceLoc = useMemo(() => !!(deviceLoc && typeof deviceLoc.lat === "number" && typeof deviceLoc.lng === "number"), [deviceLoc]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");

    const q = needQuery.trim();
    if (!q) {
      setMsg("Type what you need (ex: insulin, shelter, water).");
      return;
    }

    setLoading(true);
    try {
      // 1) Decide which location to use
      let loc = null;

      const where = whereQuery.trim();
      if (where) {
        // Ask backend to geocode city/zip
        loc = await getJson(`${API}/geocode?q=${encodeURIComponent(where)}`);
      } else if (hasDeviceLoc) {
        loc = { lat: deviceLoc.lat, lng: deviceLoc.lng, label: "My location" };
      } else {
        setMsg("Turn on location services or enter a City/ZIP.");
        setLoading(false);
        return;
      }

      // 2) Tell map where to center
      setSearchLoc({ lat: loc.lat, lng: loc.lng });

      // 3) Search nearby resources based on the need keyword
      const items = await getJson(
        `${API}/resources?query=${encodeURIComponent(q)}&lat=${encodeURIComponent(loc.lat)}&lng=${encodeURIComponent(loc.lng)}`
      );

      setResults(Array.isArray(items) ? items : []);
      if (!items || items.length === 0) {
        setMsg("No nearby results found for that need. Try a different keyword (ex: pharmacy, clinic, hospital) or a larger city.");
      }
    } catch (err) {
      console.error(err);
      setResults([]);
      setMsg(err?.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box as="form" onSubmit={handleSubmit}>
      <VStack align="stretch" spacing={3}>
        <FormControl>
          <FormLabel>What do you need?</FormLabel>
          <Input
            value={needQuery}
            onChange={(e) => setNeedQuery(e.target.value)}
            placeholder="ex: insulin, pharmacy, food, shelter"
          />
        </FormControl>

        <FormControl>
          <FormLabel>City / ZIP (optional)</FormLabel>
          <Input
            value={whereQuery}
            onChange={(e) => setWhereQuery(e.target.value)}
            placeholder={hasDeviceLoc ? "Leave blank to use your location" : "ex: State College, PA or 16801"}
          />
        </FormControl>

        <HStack>
          <Button type="submit" isLoading={loading} loadingText="Searching...">
            Find nearby help
          </Button>
        </HStack>

        {msg && (
          <Text fontSize="sm" color="gray.600">
            {msg}
          </Text>
        )}
      </VStack>
    </Box>
  );
}

