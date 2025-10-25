import { useEffect, useState } from "react";
import {
  Box, Button, Input, Select, NumberInput, NumberInputField, Textarea, VStack, Checkbox,
} from "@chakra-ui/react";

export default function NeedForm({ onCreated, userLoc = null }) {
  const [useMyLoc, setUseMyLoc] = useState(!!userLoc);
  const [form, setForm] = useState({
    title: "",
    category: "water",
    lat: userLoc ? String(userLoc.lat) : "31.15",
    lng: userLoc ? String(userLoc.lng) : "74.20",
    severity: "3",
    notes: "",
  });

  useEffect(() => {
    if (useMyLoc && userLoc) {
      setForm((s) => ({ ...s, lat: String(userLoc.lat), lng: String(userLoc.lng) }));
    }
  }, [useMyLoc, userLoc]);

  const upd = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!form.lat || !form.lng) {
      alert("Please provide latitude and longitude");
      return;
    }
    let lat = parseFloat(form.lat);
    let lng = parseFloat(form.lng);

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert("Lat must be -90..90 and Lng -180..180");
      return;
    }
    // common US fix: positive longitude → ask to flip negative
    if (lat >= 24 && lat <= 49 && lng > 0) {
      if (confirm("Longitude for U.S. locations is usually negative. Flip it?")) {
        lng = -lng;
      }
    }

    const payload = {
      title: form.title || "Untitled",
      category: form.category,
      location: { lat, lng },
      severity: parseInt(form.severity || "3"),
      // population_density & available_aid are enriched on the server
      notes: form.notes || "",
    };

    try {
      const r = await fetch("http://127.0.0.1:8000/needs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) {
        console.error("POST /needs failed", data);
        alert("Failed to post need. Check backend console.");
      }
      onCreated(data, form.category); // pass category so parent can compute nearest
      setForm((s) => ({ ...s, title: "", notes: "" }));
    } catch (e) {
      console.error(e);
      alert("Network error posting need");
    }
  }

  return (
    <Box>
      <VStack align="stretch" gap={2}>
        <Input placeholder="Title" value={form.title} onChange={(e)=>upd("title", e.target.value)} />
        <Select value={form.category} onChange={(e)=>upd("category", e.target.value)}>
          <option value="food">Food</option>
          <option value="water">Water</option>
          <option value="shelter">Shelter</option>
          <option value="medical">Medical</option>
        </Select>

        <Checkbox isChecked={useMyLoc} onChange={(e)=>setUseMyLoc(e.target.checked)}>
          Use my location
        </Checkbox>

        <Input type="number" step="any" placeholder="Latitude"  value={form.lat} onChange={(e)=>upd("lat", e.target.value)}  isDisabled={useMyLoc}/>
        <Input type="number" step="any" placeholder="Longitude" value={form.lng} onChange={(e)=>upd("lng", e.target.value)} isDisabled={useMyLoc}/>

        <NumberInput value={form.severity} min={1} max={5}>
          <NumberInputField placeholder="Severity (1-5)" onChange={(e)=>upd("severity", e.target.value)} />
        </NumberInput>

        <Textarea placeholder="Notes" value={form.notes} onChange={(e)=>upd("notes", e.target.value)} />
        <Button onClick={submit} colorScheme="blue">Submit & Find Nearest</Button>
      </VStack>
    </Box>
  );
}
