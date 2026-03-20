import { API } from "../lib/api";
import React, { useState } from "react";
import {
  Box,
  Input,
  Button,
  VStack,
  Text,
  Checkbox,
  CheckboxGroup,
  Stack,
  Select,
} from "@chakra-ui/react";


export default function NeedForm({ onCreated, userLoc }) {
  const [form, setForm] = useState({
    title: "",
    lat: "",
    lng: "",
    severity: "3", // backend expects 1..5
    notes: "",
  });

  const [useMyLoc, setUseMyLoc] = useState(false);
  const [categories, setCategories] = useState([]); // multi-select; first is posted

  const handleChange = (e) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  const toggleUseMyLoc = (checked) => {
    setUseMyLoc(checked);
    if (checked && userLoc) {
      setForm((s) => ({
        ...s,
        lat: String(userLoc.lat),
        lng: String(userLoc.lng),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title || !form.lat || !form.lng || categories.length === 0) {
      alert("Please fill title/coords and select at least one need.");
      return;
    }

    let lat = parseFloat(form.lat);
    let lng = parseFloat(form.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      alert("Latitude/Longitude must be numbers");
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert("Lat must be -90..90 and Lng -180..180");
      return;
    }

    // Helpful US fix: if lat is US range and lng positive, offer to flip to negative
    if (lat >= 24 && lat <= 49 && lng > 0) {
      if (confirm("Longitude for U.S. locations is usually negative. Flip it?")) {
        lng = -lng;
      }
    }

    const categoryForPost = categories[0]; // backend expects a single category for the created Need

    const payload = {
      title: form.title,
      category: categoryForPost,               // "food" | "water" | "shelter" | "medical"
      location: { lat, lng },                  // nested object for backend
      severity: parseInt(form.severity, 10),   // 1..5
      notes: form.notes || "",
    };

    try {
      const res = await fetch(`${API}/needs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("POST /needs failed:", errText);
        alert("Error submitting form");
        return;
      }

      const data = await res.json();

      // Notify parent (it will reload needs & priorities and can run nearest searches)
      onCreated?.(data, categories, { lat, lng });

      // reset form
      setForm({ title: "", lat: "", lng: "", severity: "3", notes: "" });
      setCategories([]);
      setUseMyLoc(false);
    } catch (err) {
      console.error(err);
      alert("Error submitting form");
    }
  };

  return (
    <Box as="form" onSubmit={handleSubmit}>
      <VStack align="stretch" spacing={3}>
        <Input
          placeholder="Need title (e.g. Water bottles)"
          name="title"
          value={form.title}
          onChange={handleChange}
        />

        <Checkbox isChecked={useMyLoc} onChange={(e) => toggleUseMyLoc(e.target.checked)}>
          Use my device location
        </Checkbox>

        <Stack direction="row" spacing={2}>
          <Input
            placeholder="Latitude"
            name="lat"
            value={form.lat}
            onChange={handleChange}
            isDisabled={useMyLoc}
          />
          <Input
            placeholder="Longitude"
            name="lng"
            value={form.lng}
            onChange={handleChange}
            isDisabled={useMyLoc}
          />
        </Stack>

        <Select name="severity" value={form.severity} onChange={handleChange}>
          <option value="1">Severity 1 (lowest)</option>
          <option value="2">Severity 2</option>
          <option value="3">Severity 3</option>
          <option value="4">Severity 4</option>
          <option value="5">Severity 5 (highest)</option>
        </Select>

        <Input
          placeholder="Notes (optional)"
          name="notes"
          value={form.notes}
          onChange={handleChange}
        />

        <Box>
          <Text fontWeight="semibold" mb={1}>Select needs (first is posted):</Text>
          <CheckboxGroup value={categories} onChange={setCategories}>
            <Stack spacing={1}>
              <Checkbox value="water">Water</Checkbox>
              <Checkbox value="food">Food</Checkbox>
              <Checkbox value="shelter">Shelter</Checkbox>
              <Checkbox value="medical">Medical</Checkbox>
            </Stack>
          </CheckboxGroup>
          <Text fontSize="sm" color="gray.600" mt={1}>
            The first checked item is used for the posted need; all selected are used to find nearby places in the UI.
          </Text>
        </Box>

        <Button colorScheme="blue" type="submit">
          Submit Need
        </Button>
      </VStack>
    </Box>
  );
}
