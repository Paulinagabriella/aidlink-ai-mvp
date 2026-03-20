import { Box, Heading, Text, VStack } from "@chakra-ui/react";

export default function ResultsList({ items = [] }) {
  return (
    <Box>
      <Heading size="sm" mb={2}>
        Nearby Help Results
      </Heading>

      <VStack align="stretch" spacing={2}>
        {items.map((r, i) => {
          const org = r.org;
          return (
            <Box key={`${org?.id || i}`} borderWidth="1px" p={2} borderRadius="md">
              <Text fontWeight="bold">
                {i + 1}. {org?.name || "Unknown"}
              </Text>
              <Text fontSize="sm">Distance: {r.km} km</Text>
              <Text fontSize="sm">
                Categories: {(org?.categories || []).join(", ")}
              </Text>
            </Box>
          );
        })}

        {items.length === 0 && (
          <Text fontSize="sm" color="gray.600">
            No search results yet.
          </Text>
        )}
      </VStack>
    </Box>
  );
}