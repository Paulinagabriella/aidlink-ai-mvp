import { HStack, Button, Text } from "@chakra-ui/react";
import { useColorMode } from "@chakra-ui/react";

export default function UiControls({ fontScale, setFontScale }) {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <HStack spacing={2}>
      <Button size="sm" onClick={toggleColorMode}>
        {colorMode === "light" ? "🌙" : "☀️"}
      </Button>
      <Button size="sm" onClick={() => setFontScale(Math.max(0.8, fontScale - 0.1))}>
        A-
      </Button>
      <Button size="sm" onClick={() => setFontScale(1.0)}>
        A
      </Button>
      <Button size="sm" onClick={() => setFontScale(Math.min(1.4, fontScale + 0.1))}>
        A+
      </Button>
      <Text fontSize="sm">Text scale: {Math.round(fontScale * 100)}%</Text>
    </HStack>
  );
}