// frontend/src/components/ResultsList.jsx
import React from "react";
import { Box, Heading, VStack, Link, Text, Badge } from "@chakra-ui/react";

export default function ResultsList({ items = [] }) {
  return (
    <Box borderWidth="1px" p={3} borderRadius="lg" aria-live="polite" role="region" aria-label="Search results list">
      <Heading size="sm" mb={2}>Results</Heading>
      <VStack align="stretch" spacing={2}>
        {items.length === 0 && <Text>No results yet.</Text>}
        {items.map((r, idx) => {
          const lat = r?.location?.lat;
          const lng = r?.location?.lng;
          const gmaps = (lat!=null && lng!=null)
            ? `https://www.google.com/maps?q=${lat},${lng}`
            : null;
          return (
            <Box key={`${r.name || "item"}-${idx}`} borderWidth="1px" p={2} borderRadius="md">
              <Box display="flex" gap={2} alignItems="center">
                <Badge>{r.category}</Badge>
                <Text fontWeight="bold">{r.name || "Resource"}</Text>
                {typeof r.km === "number" && <Text color="gray.600">• {r.km} km</Text>}
              </Box>
              {gmaps && (
                <Link href={gmaps} isExternal color="blue.500">
                  Open in Google Maps
                </Link>
              )}
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}
