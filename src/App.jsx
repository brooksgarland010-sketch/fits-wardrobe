import { useState, useRef } from "react";

const STORAGE_KEY = "wore_v1";
const EMPTY_FORM = { name: "", category: "tops", frontData: null, backData: null };

function loadWardrobe() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveWardrobe(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

const CATS = {
  tops: { label: "Top", bg: "#e8f4e8", color: "#1a5c1a" },
  bottoms: { label: "Bottom", bg: "#f0e8f8", color: "#4a1a7a" },
  outerwear: { label: "Outer", bg: "#fdf0d8", color: "#7a4a00" },
  shoes: { label: "Shoes", bg: "#e8f8f4", color: "#006644" },
  accessories: { label: "Acc.", bg: "#f8ece8", color: "#7a2a00" },
  dresses: { label: "Dress", bg: "#f8e8f0", color: "#7a0044" },
  other: { label: "Other", bg: "#f0f0ec", color: "#444" },
};

function Badge({ category }) {
  const c = CATS[category] || CATS.other;
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 7px", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>
      {c.label}
    </span>
  );
}

function Stars({ score }) {
  const filled = Math.round(score / 2);
  return (
    <span style={{ fontSize: 12, letterSpacing: 1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < filled ? "#c8f55a" : "#333" }}>★</span>
      ))}
    </span>
  );
}

export default function App() {
  const [wardrobe, setWardrobe] = useState(loadWardrobe);
  const [view, setView] = useState("wardrobe");
  const [outfits, setOutfits] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [previewItem, setPreviewItem] = useState(null);
  const [previewSide, setPreviewSide] = useState("front");
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [activeUpload, setActiveUpload] = useState(null);
  const fileRef = useRef();

  const updateWardrobe = (items) => { setWardrobe(items); saveWardrobe(items); };

  const triggerUpload = (side) => {
    setActiveUpload(side);
    fileRef.current.value = "";
    fileRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (activeUpload === "front") setAddForm(f => ({ ...f, frontData: ev.target.result }));
      if (activeUpload === "back") setAddForm(f => ({ ...f, backData: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = () => {
    if (!addForm.name || !addForm.frontData) return;
    updateWardrobe([...wardrobe, {
      id: Date.now(),
      name: addForm.name,
      category: addForm.category,
      imageData: addForm.frontData,
      backData: addForm.backData || null,
      dirty: false,
      addedAt: new Date().toISOString(),
    }]);
    setAddForm({ ...EMPTY_FORM });
    setView("wardrobe");
  };

  const toggleDirty = (id) => updateWardrobe(wardrobe.map(i => i.id === id ? { ...i, dirty: !i.dirty } : i));
  const removeItem = (id) => updateWardrobe(wardrobe.filter(i => i.id !== id));

  const generateOutfits = async () => {
    const clean = wardrobe.filter(i => !i.dirty);
    if (clean.length < 2) { alert("Add at least 2 clean items first!"); return; }
    setGenerating(true);
    setOutfits([]);
    setGenError("");
    setView("outfits");

    const limited = clean.slice(0, 8);
    const imageContent = limited.map(item => ({
      type: "image",
      source: { type: "base64", media_type: item.imageData.split(";")[0].split(":")[1], data: item.imageData.split(",")[1] }
    }));
    const itemList = limited.map((it, i) => `${i + 1}. ID=${it.id} | "${it.name}" | ${it.category}`).join("\n");

    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: [...imageContent, {
              type: "text",
              text: `You are an expert fashion stylist. Here are ${limited.length} clothing items (images above in order):\n\n${itemList}\n\nCreate 4 stylish outfit combinations. Return ONLY raw JSON, no markdown:\n{"outfits":[{"name":"string","itemIds":[number,number],"description":"string","styleScore":8,"tips":"string"}]}`
            }]
          }]
        })
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const rawText = data.content?.find(b => b.type === "text")?.text || "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");

      const parsed = JSON.parse(jsonMatch[0]);
      const enriched = parsed.outfits
        .map(o => ({ ...o, items: (o.itemIds || []).map(id => clean.find(i => i.id === id)).filter(Boolean) }))
        .filter(o => o.items.length > 0)
        .sort((a, b) => b.styleScore - a.styleScore);

      setOutfits(enriched);
    } catch (err) {
      setGenError(err.message || "Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const cleanCount = wardrobe.filter(i => !i.dirty).length;
  const dirtyCount = wardrobe.filter(i => i.dirty).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "'Inter', sans-serif" }}>

      <header style={{ background: "#0d0d0d", padding: "0 1.25rem", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", lineHeight: 1 }}>
            wore<span style={{ color: "#c8f55a" }}>.</span>
          </div>
          <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 1 }}>AI wardrobe stylist</div>
        </div>
        <nav style={{ display: "flex", gap: 5 }}>
          {[
            { key: "wardrobe", label: "Closet" },
            { key: "add", label: "+ Add" },
            { key: "outfits", label: "Outfits" },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => tab.key === "outfits" ? generateOutfits() : setView(tab.key)}
              style={{
                background: view === tab.key ? "#c8f55a" : "#1a1a1a",
                color: view === tab.key ? "#0d0d0d" : "#888",
                border: "none", borderRadius: 20, padding: "7px 13px",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Inter', sans-serif", letterSpacing: "0.02em",
                transition: "all 0.15s",
              }}>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {view === "wardrobe" && wardrobe.length > 0 && (
        <div style={{ background: "#0d0d0d", padding: "0 1.25rem 14px", display: "flex", gap: 10 }}>
          {[
            { label: "Total", value: wardrobe.length, color: "#fff" },
            { label: "Clean", value: cleanCount, color: "#c8f55a" },
            { label: "Dirty", value: dirtyCount, color: "#ff6b6b" },
          ].map(s => (
            <div key={s.label} style={{ background: "#1a1a1a", borderRadius: 10, padding: "8px 14px", flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "1.25rem" }}>

        {view === "wardrobe" && (
          wardrobe.length === 0 ? (
            <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
              <div style={{ width: 80, height: 80, background: "#0d0d0d", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px" }}>👗</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#0d0d0d", marginBottom: 8 }}>Your closet is empty</div>
              <div style={{ color: "#999", fontSize: 14, marginBottom: "2rem" }}>Add your first clothing item to get started</div>
              <button onClick={() => setView("add")} style={fab}>+ Add first item</button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#0d0d0d" }}>My Closet</div>
                <button onClick={() => setView("add")} style={fabSmall}>+ Add item</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
                {wardrobe.map(item => (
                  <div key={item.id} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: item.dirty ? "1.5px solid #ffaaaa" : "1px solid #ece9e2" }}>
                    <div onClick={() => { setPreviewItem(item); setPreviewSide("front"); }} style={{ position: "relative", cursor: "pointer" }}>
                      <img src={item.imageData} alt={item.name} style={{ width: "100%", height: 165, objectFit: "cover", display: "block" }} />
                      {item.dirty && (
                        <div style={{ position: "absolute", top: 8, left: 8, background: "#0d0d0d", color: "#ff6b6b", fontSize: 9, fontWeight: 800, borderRadius: 5, padding: "2px 7px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Dirty</div>
                      )}
                      {item.backData && (
                        <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(13,13,13,0.75)", color: "#c8f55a", fontSize: 9, fontWeight: 700, borderRadius: 5, padding: "2px 7px" }}>+BACK</div>
                      )}
                    </div>
                    <div style={{ padding: "10px 11px 11px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0d0d0d", marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                      <Badge category={item.category} />
                      <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                        <button onClick={() => toggleDirty(item.id)}
                          style={{ flex: 1, border: "none", background: item.dirty ? "#fff0f0" : "#f0fde4", borderRadius: 8, padding: "6px 0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: item.dirty ? "#cc3333" : "#3b6d11" }}>
                          {item.dirty ? "🧺" : "✓"}
                        </button>
                        <button onClick={() => removeItem(item.id)}
                          style={{ border: "none", background: "#f5f4f0", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "#bbb" }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {view === "add" && (
          <div style={{ maxWidth: 440, margin: "0 auto" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#0d0d0d", marginBottom: "1.25rem" }}>Add New Item</div>
            <div style={{ background: "#fff", borderRadius: 20, padding: "1.5rem", border: "1px solid #ece9e2" }}>
              <div style={fieldLabel}>Photos</div>
              <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem" }}>
                {[
                  { side: "front", label: "Front", required: true, data: addForm.frontData },
                  { side: "back", label: "Back", required: false, data: addForm.backData },
                ].map(({ side, label, required, data }) => (
                  <div key={side} onClick={() => triggerUpload(side)}
                    style={{ flex: 1, border: data ? "1.5px solid #c8f55a" : "1.5px dashed #ddd", borderRadius: 14, background: data ? "#0d0d0d" : "#fafaf8", cursor: "pointer", overflow: "hidden", minHeight: 150, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6, position: "relative" }}>
                    {data ? (
                      <>
                        <img src={data} alt={label} style={{ width: "100%", height: 150, objectFit: "cover", opacity: 0.85 }} />
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,13,13,0.7)", color: "#c8f55a", fontSize: 10, fontWeight: 800, textAlign: "center", padding: "4px 0", letterSpacing: "0.1em", textTransform: "uppercase" }}>✓ {label}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 26, opacity: 0.3 }}>📷</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb" }}>{label}{required ? " *" : ""}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

              <div style={{ marginBottom: "1rem" }}>
                <div style={fieldLabel}>Item Name *</div>
                <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Navy slim chinos" style={fieldInput} />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <div style={fieldLabel}>Category</div>
                <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} style={fieldInput}>
                  {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setAddForm({ ...EMPTY_FORM }); setView("wardrobe"); }}
                  style={{ flex: 1, background: "#f5f4f0", color: "#666", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
                <button onClick={handleAdd} disabled={!addForm.name || !addForm.frontData}
                  style={{ flex: 2, background: !addForm.name || !addForm.frontData ? "#e0e0d8" : "#0d0d0d", color: !addForm.name || !addForm.frontData ? "#aaa" : "#c8f55a", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: !addForm.name || !addForm.frontData ? "not-allowed" : "pointer", fontFamily: "'Syne', sans-serif", letterSpacing: "0.03em" }}>
                  Add to Closet
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "outfits" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#0d0d0d" }}>Today's Picks</div>
              <button onClick={generateOutfits} disabled={generating}
                style={{ background: "#0d0d0d", color: "#c8f55a", border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                {generating ? "Styling..." : "↻ Restyle"}
              </button>
            </div>

            {generating && (
              <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
                <div style={{ width: 64, height: 64, background: "#0d0d0d", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px" }}>✨</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#0d0d0d", marginBottom: 8 }}>Styling your fits...</div>
                <div style={{ color: "#999", fontSize: 13 }}>Claude is analyzing your wardrobe</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#c8f55a", animation: "pulse 1.2s infinite", animationDelay: `${i*0.2}s` }} />
                  ))}
                </div>
                <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.5);opacity:0.3}40%{transform:scale(1);opacity:1}}`}</style>
              </div>
            )}

            {!generating && genError && (
              <div style={{ background: "#fff", border: "1px solid #ffcccc", borderRadius: 16, padding: "2rem", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: "#0d0d0d", marginBottom: 6 }}>Generation failed</div>
                <div style={{ color: "#999", fontSize: 13, marginBottom: "1.25rem" }}>{genError}</div>
                <button onClick={generateOutfits} style={fab}>Try again</button>
              </div>
            )}

            {!generating && !genError && outfits.length === 0 && (
              <div style={{ textAlign: "center", padding: "4rem", color: "#999", fontSize: 14 }}>Hit "Restyle" to generate outfits from your clean items.</div>
            )}

            {outfits.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {outfits.map((outfit, i) => (
                  <div key={i} style={{ background: "#fff", borderRadius: 20, overflow: "hidden", border: i === 0 ? "1.5px solid #c8f55a" : "1px solid #ece9e2" }}>
                    <div style={{ background: "#0d0d0d", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: "#fff" }}>{outfit.name}</div>
                        <div style={{ marginTop: 3 }}><Stars score={outfit.styleScore} /></div>
                      </div>
                      <div style={{ background: "#c8f55a", color: "#0d0d0d", fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13, borderRadius: 20, padding: "5px 12px" }}>
                        {outfit.styleScore}/10
                      </div>
                    </div>
                    <div style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", gap: 10, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
                        {outfit.items.map(item => (
                          <div key={item.id} style={{ flex: "0 0 auto", textAlign: "center" }}>
                            <img src={item.imageData} alt={item.name} style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 12, display: "block", border: "1px solid #ece9e2" }} />
                            <div style={{ fontSize: 10, color: "#aaa", marginTop: 4, maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: 13, color: "#555", lineHeight: 1.65, margin: "0 0 10px" }}>{outfit.description}</p>
                      <div style={{ background: "#f5fde8", borderRadius: 10, padding: "9px 12px", fontSize: 12, color: "#3b6d11", fontWeight: 500 }}>
                        💡 {outfit.tips}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {previewItem && (
        <div onClick={() => setPreviewItem(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, overflow: "hidden", maxWidth: 360, width: "100%" }}>
            <img src={previewSide === "front" ? previewItem.imageData : (previewItem.backData || previewItem.imageData)}
              alt={previewItem.name} style={{ width: "100%", maxHeight: 380, objectFit: "cover" }} />
            {previewItem.backData && (
              <div style={{ display: "flex" }}>
                {["front","back"].map(side => (
                  <button key={side} onClick={() => setPreviewSide(side)}
                    style={{ flex: 1, padding: "11px", border: "none", background: previewSide === side ? "#0d0d0d" : "#f5f4f0", color: previewSide === side ? "#c8f55a" : "#999", fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Syne', sans-serif" }}>
                    {side}
                  </button>
                ))}
              </div>
            )}
            <div style={{ padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 17, color: "#0d0d0d" }}>{previewItem.name}</div>
                  <div style={{ marginTop: 6 }}><Badge category={previewItem.category} /></div>
                </div>
                <span style={{ background: previewItem.dirty ? "#fff0f0" : "#f0fde4", color: previewItem.dirty ? "#cc3333" : "#3b6d11", padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                  {previewItem.dirty ? "Dirty" : "Clean"}
                </span>
              </div>
              <button onClick={() => setPreviewItem(null)}
                style={{ width: "100%", background: "#0d0d0d", color: "#c8f55a", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const fab = { background: "#0d0d0d", color: "#c8f55a", border: "none", borderRadius: 12, padding: "13px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne', sans-serif", letterSpacing: "0.03em" };
const fabSmall = { background: "#0d0d0d", color: "#c8f55a", border: "none", borderRadius: 20, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" };
const fieldLabel = { fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7 };
const fieldInput = { width: "100%", padding: "11px 14px", border: "1.5px solid #ece9e2", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fafaf8", color: "#0d0d0d" };
