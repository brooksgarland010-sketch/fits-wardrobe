import { useState, useRef } from "react";

const STORAGE_KEY = "wardrobe_v2";
const EMPTY_FORM = { name: "", category: "tops", frontData: null, backData: null };

function loadWardrobe() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveWardrobe(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function CategoryBadge({ category }) {
  const map = {
    tops: { color: "#d4f0ff", text: "#0a5c80", label: "Top" },
    bottoms: { color: "#fde8ff", text: "#6b0a80", label: "Bottom" },
    outerwear: { color: "#fff3d4", text: "#7a4e00", label: "Outer" },
    shoes: { color: "#d4ffe8", text: "#0a5c30", label: "Shoes" },
    accessories: { color: "#ffe8d4", text: "#7a2e00", label: "Acc." },
    dresses: { color: "#ffd4e8", text: "#7a0a3a", label: "Dress" },
    other: { color: "#e8e8e8", text: "#333", label: "Other" },
  };
  const s = map[category] || map.other;
  return (
    <span style={{ background: s.color, color: s.text, fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 8px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {s.label}
    </span>
  );
}

function StarRating({ score }) {
  const stars = Math.round(score / 2);
  return (
    <span style={{ color: "#f5a623", fontSize: 14 }}>
      {"★".repeat(stars)}{"☆".repeat(5 - stars)}
      <span style={{ color: "#888", fontSize: 12, marginLeft: 4 }}>{score}/10</span>
    </span>
  );
}

function ImageUploadBox({ label, imageData, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        border: imageData ? "2px solid #e8c547" : "2px dashed #ddd",
        borderRadius: 12,
        background: imageData ? "#000" : "#fafafa",
        cursor: "pointer",
        overflow: "hidden",
        minHeight: 160,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 6,
        position: "relative",
        transition: "border-color 0.2s",
      }}
    >
      {imageData ? (
        <>
          <img src={imageData} alt={label} style={{ width: "100%", height: 160, objectFit: "cover", display: "block", opacity: 0.9 }} />
          <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, textAlign: "center", background: "rgba(0,0,0,0.55)", color: "#e8c547", fontSize: 11, fontWeight: 700, padding: "3px 0", letterSpacing: "0.1em" }}>
            ✓ {label.toUpperCase()}
          </div>
        </>
      ) : (
        <>
          <span style={{ fontSize: 28 }}>📷</span>
          <span style={{ color: "#aaa", fontSize: 12, fontWeight: 600 }}>{label}</span>
        </>
      )}
    </div>
  );
}

export default function App() {
  const [wardrobe, setWardrobe] = useState(loadWardrobe);
  const [view, setView] = useState("wardrobe");
  const [outfits, setOutfits] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [genError, setGenError] = useState("");
  const [previewItem, setPreviewItem] = useState(null);
  const [previewSide, setPreviewSide] = useState("front");
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [activeUpload, setActiveUpload] = useState(null); // "front" | "back"
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
    const item = {
      id: Date.now(),
      name: addForm.name,
      category: addForm.category,
      imageData: addForm.frontData,
      backData: addForm.backData || null,
      dirty: false,
      addedAt: new Date().toISOString(),
    };
    updateWardrobe([...wardrobe, item]);
    setAddForm({ ...EMPTY_FORM }); // ← reset form completely
    setView("wardrobe");
  };

  const toggleDirty = (id) => updateWardrobe(wardrobe.map(i => i.id === id ? { ...i, dirty: !i.dirty } : i));
  const removeItem = (id) => updateWardrobe(wardrobe.filter(i => i.id !== id));

  const generateOutfits = async () => {
    const cleanItems = wardrobe.filter(i => !i.dirty);
    if (cleanItems.length < 2) {
      alert("Add at least 2 clean clothing items to generate outfits!");
      return;
    }
    setGenerating(true);
    setOutfits([]);
    setGenError("");
    setView("outfits");
    setGenStatus("Analyzing your wardrobe...");

    // Only send front images, keep payload small (max 8 items to avoid token limits)
    const limited = cleanItems.slice(0, 8);

    const imageContent = limited.map(item => ({
      type: "image",
      source: {
        type: "base64",
        media_type: item.imageData.split(";")[0].split(":")[1],
        data: item.imageData.split(",")[1],
      }
    }));

    const itemList = limited.map((it, i) => `${i + 1}. ID=${it.id} | "${it.name}" | ${it.category}`).join("\n");

    const textContent = {
      type: "text",
      text: `You are an expert fashion stylist. I'm showing you ${limited.length} clothing items from my wardrobe. The images are listed above in this exact order:

${itemList}

Please create 4 complete outfit combinations using ONLY items from this list. Mix and match to make stylish looks. Use each item's exact numeric ID.

Return ONLY a raw JSON object with no markdown formatting, no backticks, no explanation. Just the JSON:
{"outfits":[{"name":"string","itemIds":[number,number],"description":"string","styleScore":8,"tips":"string"}]}`
    };

    try {
      setGenStatus("Claude is styling your outfits...");
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{ role: "user", content: [...imageContent, textContent] }]
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error ${response.status}: ${err}`);
      }

      const data = await response.json();

      if (data.error) throw new Error(data.error.message || "API returned error");

      const rawText = data.content?.find(b => b.type === "text")?.text || "";

      // Robust JSON extraction — find first { ... } block
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.outfits?.length) throw new Error("No outfits in response");

      const enriched = parsed.outfits.map(outfit => ({
        ...outfit,
        items: (outfit.itemIds || [])
          .map(id => cleanItems.find(i => i.id === id))
          .filter(Boolean),
      })).filter(o => o.items.length > 0);

      enriched.sort((a, b) => b.styleScore - a.styleScore);
      setOutfits(enriched);
      setGenStatus("");
    } catch (err) {
      console.error("Outfit generation error:", err);
      setGenError(err.message || "Something went wrong. Please try again.");
      setGenStatus("");
    } finally {
      setGenerating(false);
    }
  };

  const cleanCount = wardrobe.filter(i => !i.dirty).length;
  const dirtyCount = wardrobe.filter(i => i.dirty).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f2", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {/* Header */}
      <header style={{ background: "#1a1a2e", borderBottom: "3px solid #e8c547", padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>👗</span>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 20, letterSpacing: "-0.5px", lineHeight: 1 }}>FITS</div>
            <div style={{ color: "#e8c547", fontSize: 9, letterSpacing: "0.3em", fontWeight: 600 }}>AI WARDROBE</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {[
            { key: "wardrobe", label: "Wardrobe", icon: "👔" },
            { key: "add", label: "Add Item", icon: "+" },
            { key: "outfits", label: "Outfits", icon: "✨" },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => tab.key === "outfits" ? generateOutfits() : setView(tab.key)}
              style={{ background: view === tab.key ? "#e8c547" : "transparent", color: view === tab.key ? "#1a1a2e" : "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Stats Bar */}
      {view === "wardrobe" && (
        <div style={{ background: "#1a1a2e", padding: "8px 1.5rem 12px", display: "flex", gap: 20 }}>
          <StatChip icon="🧺" label="Total" value={wardrobe.length} color="#e8c547" />
          <StatChip icon="✅" label="Clean" value={cleanCount} color="#4ecdc4" />
          <StatChip icon="🔴" label="Dirty" value={dirtyCount} color="#ff6b6b" />
        </div>
      )}

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "1.5rem" }}>

        {/* WARDROBE */}
        {view === "wardrobe" && (
          wardrobe.length === 0 ? <EmptyState onAdd={() => setView("add")} /> : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>My Closet</h2>
                <button onClick={() => setView("add")} style={addBtnStyle}>+ Add Item</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
                {wardrobe.map(item => (
                  <ClothingCard key={item.id} item={item}
                    onToggleDirty={() => toggleDirty(item.id)}
                    onRemove={() => removeItem(item.id)}
                    onPreview={() => { setPreviewItem(item); setPreviewSide("front"); }} />
                ))}
              </div>
            </div>
          )
        )}

        {/* ADD ITEM */}
        {view === "add" && (
          <div style={{ maxWidth: 460, margin: "0 auto" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", marginBottom: "1.25rem" }}>Add Clothing Item</h2>
            <div style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", boxShadow: "0 2px 20px rgba(0,0,0,0.08)" }}>

              {/* Photo Upload — Front & Back */}
              <label style={labelStyle}>Photos</label>
              <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem" }}>
                <ImageUploadBox label="Front (required)" imageData={addForm.frontData} onClick={() => triggerUpload("front")} />
                <ImageUploadBox label="Back (optional)" imageData={addForm.backData} onClick={() => triggerUpload("back")} />
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>Item Name</label>
                <input
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Navy slim chinos"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={labelStyle}>Category</label>
                <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                  {["tops","bottoms","outerwear","shoes","accessories","dresses","other"].map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setAddForm({ ...EMPTY_FORM }); setView("wardrobe"); }} style={{ flex: 1, ...cancelBtnStyle }}>Cancel</button>
                <button onClick={handleAdd} disabled={!addForm.name || !addForm.frontData}
                  style={{ flex: 2, ...primaryBtnStyle, opacity: (!addForm.name || !addForm.frontData) ? 0.4 : 1 }}>
                  Add to Wardrobe
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OUTFITS */}
        {view === "outfits" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>Your Outfits</h2>
              <button onClick={generateOutfits} disabled={generating} style={addBtnStyle}>
                {generating ? "Styling..." : "↻ Regenerate"}
              </button>
            </div>

            {generating && (
              <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#1a1a2e", marginBottom: 8 }}>Claude is styling your fits...</div>
                <div style={{ color: "#888", fontSize: 14 }}>{genStatus}</div>
                <LoadingDots />
              </div>
            )}

            {!generating && genError && (
              <div style={{ background: "#fff5f5", border: "1px solid #ffcccc", borderRadius: 12, padding: "1.5rem", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
                <div style={{ fontWeight: 600, color: "#c0392b", marginBottom: 6 }}>Outfit generation failed</div>
                <div style={{ color: "#888", fontSize: 13, marginBottom: "1rem" }}>{genError}</div>
                <button onClick={generateOutfits} style={primaryBtnStyle}>Try Again</button>
              </div>
            )}

            {!generating && !genError && outfits.length === 0 && (
              <div style={{ textAlign: "center", padding: "4rem", color: "#888" }}>No outfits yet — click Regenerate!</div>
            )}

            {outfits.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {outfits.map((outfit, i) => <OutfitCard key={i} outfit={outfit} rank={i + 1} />)}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Preview Modal */}
      {previewItem && (
        <div onClick={() => setPreviewItem(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, overflow: "hidden", maxWidth: 380, width: "100%" }}>
            <img
              src={previewSide === "front" ? previewItem.imageData : (previewItem.backData || previewItem.imageData)}
              alt={previewItem.name}
              style={{ width: "100%", maxHeight: 380, objectFit: "cover" }}
            />
            {previewItem.backData && (
              <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #eee" }}>
                {["front","back"].map(side => (
                  <button key={side} onClick={() => setPreviewSide(side)}
                    style={{ flex: 1, padding: "10px", border: "none", background: previewSide === side ? "#1a1a2e" : "#f8f8f8", color: previewSide === side ? "#e8c547" : "#888", fontWeight: 700, fontSize: 13, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {side}
                  </button>
                ))}
              </div>
            )}
            <div style={{ padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: "#1a1a2e" }}>{previewItem.name}</div>
                  <div style={{ marginTop: 5 }}><CategoryBadge category={previewItem.category} /></div>
                </div>
                <span style={{ background: previewItem.dirty ? "#ffeeee" : "#eefff5", color: previewItem.dirty ? "#c0392b" : "#27ae60", padding: "4px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  {previewItem.dirty ? "🔴 Dirty" : "✅ Clean"}
                </span>
              </div>
              <button onClick={() => setPreviewItem(null)} style={{ width: "100%", ...cancelBtnStyle }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ icon, label, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span>{icon}</span>
      <span style={{ color: "#888", fontSize: 12 }}>{label}</span>
      <span style={{ color, fontWeight: 700, fontSize: 15 }}>{value}</span>
    </div>
  );
}

function ClothingCard({ item, onToggleDirty, onRemove, onPreview }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: item.dirty ? "2px solid #ff6b6b" : "2px solid transparent", transition: "all 0.2s" }}>
      <div onClick={onPreview} style={{ position: "relative", cursor: "pointer" }}>
        <img src={item.imageData} alt={item.name} style={{ width: "100%", height: 170, objectFit: "cover", display: "block" }} />
        {item.dirty && (
          <div style={{ position: "absolute", top: 8, right: 8, background: "#ff6b6b", color: "#fff", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>DIRTY</div>
        )}
        {item.backData && (
          <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>+BACK</div>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a2e", marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
        <CategoryBadge category={item.category} />
        <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
          <button onClick={onToggleDirty} title={item.dirty ? "Mark clean" : "Mark dirty"}
            style={{ flex: 1, border: "1px solid #eee", background: item.dirty ? "#fff5f5" : "#f5fff8", borderRadius: 7, padding: "5px 0", cursor: "pointer", fontSize: 14 }}>
            {item.dirty ? "🧺" : "✅"}
          </button>
          <button onClick={onRemove} title="Remove"
            style={{ border: "1px solid #eee", background: "#fff", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 14, color: "#e74c3c" }}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function OutfitCard({ outfit, rank }) {
  const medals = ["🥇", "🥈", "🥉", "👗"];
  const rankColors = ["#e8c547", "#b0b0b0", "#cd7f32", "#eee"];
  return (
    <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 3px 20px rgba(0,0,0,0.09)", border: rank === 1 ? "2px solid #e8c547" : "1px solid #eee" }}>
      <div style={{ background: rank === 1 ? "#1a1a2e" : "#f8f8f8", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{medals[rank - 1] || "👗"}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: rank === 1 ? "#e8c547" : "#1a1a2e" }}>{outfit.name}</div>
            <StarRating score={outfit.styleScore} />
          </div>
        </div>
        <div style={{ background: rankColors[rank - 1] || "#eee", color: rank <= 3 ? "#1a1a2e" : "#888", fontWeight: 800, fontSize: 13, borderRadius: 20, padding: "4px 12px" }}>
          #{rank}
        </div>
      </div>
      <div style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
          {outfit.items.map(item => (
            <div key={item.id} style={{ flex: "0 0 auto", textAlign: "center" }}>
              <img src={item.imageData} alt={item.name} style={{ width: 75, height: 75, objectFit: "cover", borderRadius: 10, display: "block", border: "2px solid #f0f0f0" }} />
              <div style={{ fontSize: 10, color: "#888", marginTop: 3, maxWidth: 75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: "0 0 10px" }}>{outfit.description}</p>
        <div style={{ background: "#fffdf0", border: "1px solid #f0e8a0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#7a6000" }}>
          💡 <strong>Tip:</strong> {outfit.tips}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
      <div style={{ fontSize: 60, marginBottom: 14 }}>👕</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", marginBottom: 8 }}>Your closet is empty</h2>
      <p style={{ color: "#888", marginBottom: "1.5rem" }}>Start by adding photos of your clothes</p>
      <button onClick={onAdd} style={primaryBtnStyle}>+ Add Your First Item</button>
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#e8c547", animation: "bounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.5);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

const inputStyle = { width: "100%", padding: "10px 14px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fafafa" };
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 };
const primaryBtnStyle = { background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const cancelBtnStyle = { background: "#f0f0f0", color: "#333", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const addBtnStyle = { background: "#e8c547", color: "#1a1a2e", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
