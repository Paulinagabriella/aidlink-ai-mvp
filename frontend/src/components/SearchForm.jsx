import { useState } from "react";
import {
  Box,
  Button,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { API } from "../lib/api";

export default function SearchForm({ setResults, setSearchLoc, deviceLoc }) {
  const [query, setQuery] = useState("");
  const [locationText, setLocationText] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    const category = query.trim().toLowerCase();
    if (!category) {
      alert("Please enter what you need.");
      return;
    }

    if (!deviceLoc) {
      alert("This demo currently uses your device location. Please allow location access.");
      return;
    }

    if (locationText.trim()) {
      console.warn("City / ZIP entered, but demo is using device location only.");
    }

    setLoading(true);
    try {
      const url = `${API}/nearest-orgs?lat=${deviceLoc.lat}&lng=${deviceLoc.lng}&category=${encodeURIComponent(category)}&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setSearchLoc(deviceLoc);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch nearby help.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box>
      <VStack align="stretch" spacing={3}>
        <Box>
          <Text fontWeight="semibold" mb={1}>
            What do you need?
          </Text>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ex: insulin, pharmacy, food, shelter"
          />
        </Box>

        <Box>
          <Text fontWeight="semibold" mb={1}>
            City / ZIP (optional)
          </Text>
          <Input
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder="Leave blank to use your location"
          />
        </Box>

        <Button onClick={onSubmit} isLoading={loading} colorScheme="blue">
          Find nearby help
        </Button>
      </VStack>
    </Box>
  );
}