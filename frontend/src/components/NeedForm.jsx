import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Input,
  Select,
  NumberInput,
  NumberInputField,
  Text,
  Textarea,
  VStack,
  Checkbox,
} from "@chakra-ui/react";
import { API } from "../lib/api";

export default function NeedForm({ onCreated, userLoc = null }) {
  const [useMyLoc, setUseMyLoc] = useState(!!userLoc);
  const [form, setForm] = useState({
    title: "",
    category: "water",
    lat: userLoc ? String(userLoc.lat) : "",
    lng: userLoc ? String(userLoc.lng) : "",
    severity: "3",
    notes: "",
  });

  useEffect(() => {
    if (useMyLoc && userLoc) {
      setForm((s) => ({
        ...s,
        lat: String(userLoc.lat),
        lng: String(userLoc.lng),
      }));
    }
  }, [useMyLoc, userLoc]);

  const upd = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!form.title.trim()) {
      alert("Please enter a title.");
      return;
    }

    if (!form.lat || !form.lng) {
      alert("Please provide latitude and longitude.");
      return;
    }

    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert("Latitude and longitude must be valid numbers.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      category: form.category,
      location: { lat, lng },
      severity: parseInt(form.severity || "3", 10),
      notes: form.notes || "",
    };

    try {
      const res = await fetch(`${API}/needs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : await res.text();

      if (!res.ok) {
        console.error(data);
        alert("Failed to post need.");
        return;
      }

      setForm((s) => ({
        ...s,
        title: "",
        notes: "",
      }));

      if (onCreated) onCreated(data);
    } catch (e) {
      console.error(e);
      alert("Network error posting need.");
    }
  }

  return (
    <Box>
      <VStack align="stretch" spacing={2}>
        <Input
          placeholder="Need title (e.g. Water bottles)"
          value={form.title}
          onChange={(e) => upd("title", e.target.value)}
        />

        <Checkbox
          isChecked={useMyLoc}
          onChange={(e) => setUseMyLoc(e.target.checked)}
        >
          Use my device location
        </Checkbox>

        <Select value={form.category} onChange={(e) => upd("category", e.target.value)}>
          <option value="food">Food</option>
          <option value="water">Water</option>
          <option value="shelter">Shelter</option>
          <option value="medical">Medical</option>
        </Select>

        <Input
          placeholder="Latitude"
          value={form.lat}
          onChange={(e) => upd("lat", e.target.value)}
          isDisabled={useMyLoc}
        />

        <Input
          placeholder="Longitude"
          value={form.lng}
          onChange={(e) => upd("lng", e.target.value)}
          isDisabled={useMyLoc}
        />

        <Box>
          <Text fontSize="sm" mb={1}>
            Severity (1–5)
          </Text>
          <NumberInput min={1} max={5} value={form.severity}>
            <NumberInputField onChange={(e) => upd("severity", e.target.value)} />
          </NumberInput>
        </Box>

        <Textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => upd("notes", e.target.value)}
        />

        <Button onClick={submit} colorScheme="blue">
          Submit
        </Button>
      </VStack>
    </Box>
  );
}
