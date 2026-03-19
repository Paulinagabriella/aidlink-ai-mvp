import React from "react";
import { HStack, Button, IconButton, useColorMode, Text } from "@chakra-ui/react";
import { MoonIcon, SunIcon } from "@chakra-ui/icons";

export default function UiControls({ fontScale, setFontScale }) {
  const { colorMode, toggleColorMode } = useColorMode();
  const dec = () => setFontScale((v) => Math.max(0.85, +(v - 0.05).toFixed(2)));
  const norm = () => setFontScale(1.0);
  const inc = () => setFontScale((v) => Math.min(1.4, +(v + 0.05).toFixed(2)));

  return (
    <HStack spacing={2}>
      <IconButton
        aria-label="Toggle color mode"
        onClick={toggleColorMode}
        icon={colorMode === "dark" ? <SunIcon /> : <MoonIcon />}
        size="sm"
        variant="outline"
      />
      <HStack spacing={1}>
        <Button size="sm" onClick={dec} aria-label="Decrease font size">A-</Button>
        <Button size="sm" onClick={norm} aria-label="Reset font size">A</Button>
        <Button size="sm" onClick={inc} aria-label="Increase font size">A+</Button>
      </HStack>
      <Text fontSize="sm" aria-live="polite">Text scale: {Math.round(fontScale * 100)}%</Text>
    </HStack>
  );
}
