import { useState, useCallback, useRef } from "react";

const STORAGE_KEY = "wardrobe_v1";

function loadWardrobe() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
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

export default function App() {
  const [wardrobe, setWardrobe] = useState(loadWardrobe);
  const [view, setView] = useState("wardrobe"); // wardrobe | add | outfits
  const [outfits, setOutfits] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [previewItem, setPreviewItem] = useState(null);
  const [addForm, setAddForm] = useState({ name: "", category: "tops", image: null, imageData: null });
  const fileRef = useRef();

  const updateWardrobe = (items) => {
    setWardrobe(items);
    saveWardrobe(items);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAddForm(f => ({ ...f, image: file, imageData: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = () => {
    if (!addForm.name || !addForm.imageData) return;
    const item = {
      id: Date.now(),
      name: addForm.name,
      category: addForm.category,
      imageData: addForm.imageData,
      dirty: false,
      addedAt: new Date().toISOString(),
    };
    const next = [...wardrobe, item];
    updateWardrobe(next);
    setAddForm({ name: "", category: "tops", image: null, imageData: null });
    setView("wardrobe");
  };

  const toggleDirty = (id) => {
    updateWardrobe(wardrobe.map(i => i.id === id ? { ...i, dirty: !i.dirty } : i));
  };

  const removeItem = (id) => {
    updateWardrobe(wardrobe.filter(i => i.id !== id));
  };

  const generateOutfits = async () => {
    const cleanItems = wardrobe.filter(i => !i.dirty);
    if (cleanItems.length < 2) {
      alert("Add at least 2 clean clothing items to generate outfits!");
      return;
    }
    setGenerating(true);
    setOutfits([]);
    setView("outfits");
    setGenStatus("Analyzing your wardrobe...");

    // Build item list with images for the API
    const itemDescriptions = cleanItems.map(i => ({
      id: i.id,
      name: i.name,
      category: i.category,
    }));

    // Prepare content array with images
    const imageContent = cleanItems.map(item => ({
      type: "image",
      source: {
        type: "base64",
        media_type: item.imageData.split(";")[0].split(":")[1],
        data: item.imageData.split(",")[1],
      }
    }));

    const labelContent = {
      type: "text",
      text: `You are a professional fashion stylist. Here are ${cleanItems.length} clothing items from the user's wardrobe (images provided above in order):

Items (in order of images):
${itemDescriptions.map((it, i) => `${i + 1}. [ID:${it.id}] "${it.name}" (${it.category})`).join("\n")}

Create 4 stylish, complete outfit combinations using ONLY these items. Each outfit should:
- Use 2-4 items that work well together
- Reference items by their [ID:xxx] identifier
- Have a creative outfit name
- Include a style description (1-2 sentences)
- Be rated /10 for style (be honest and critical)
- Include brief styling tips

Respond ONLY with valid JSON (no markdown), this exact structure:
{
  "outfits": [
    {
      "name": "outfit name",
      "itemIds": [id1, id2, id3],
      "description": "style description",
      "styleScore": 8,
      "tips": "styling tips"
    }
  ]
}`
    };

    try {
      setGenStatus("Claude is styling your outfits...");
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [...imageContent, labelContent]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      // Enrich outfits with actual item data
      const enriched = parsed.outfits.map(outfit => ({
        ...outfit,
        items: outfit.itemIds.map(id => wardrobe.find(i => i.id === id)).filter(Boolean),
      }));

      // Sort by styleScore descending
      enriched.sort((a, b) => b.styleScore - a.styleScore);
      setOutfits(enriched);
      setGenStatus("");
    } catch (err) {
      setGenStatus("Error generating outfits. Please try again.");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const cleanCount = wardrobe.filter(i => !i.dirty).length;
  const dirtyCount = wardrobe.filter(i => i.dirty).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f2", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {/* Header */}
      <header style={{
        background: "#1a1a2e",
        borderBottom: "3px solid #e8c547",
        padding: "0 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>👗</span>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 20, letterSpacing: "-0.5px", lineHeight: 1 }}>FITS</div>
            <div style={{ color: "#e8c547", fontSize: 10, letterSpacing: "0.3em", fontWeight: 600 }}>AI WARDROBE</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {[
            { key: "wardrobe", label: "Wardrobe", icon: "👔" },
            { key: "add", label: "Add Item", icon: "+" },
            { key: "outfits", label: "Outfits", icon: "✨" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => tab.key === "outfits" ? generateOutfits() : setView(tab.key)}
              style={{
                background: view === tab.key ? "#e8c547" : "transparent",
                color: view === tab.key ? "#1a1a2e" : "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <span>{tab.icon}</span>
              <span style={{ display: window.innerWidth < 500 ? "none" : "inline" }}>{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Stats Bar */}
      {view === "wardrobe" && (
        <div style={{ background: "#1a1a2e", padding: "10px 2rem 14px", display: "flex", gap: 24, borderBottom: "1px solid #2a2a3e" }}>
          <StatChip icon="🧺" label="Total" value={wardrobe.length} color="#e8c547" />
          <StatChip icon="✅" label="Clean" value={cleanCount} color="#4ecdc4" />
          <StatChip icon="🔴" label="Dirty" value={dirtyCount} color="#ff6b6b" />
        </div>
      )}

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* WARDROBE VIEW */}
        {view === "wardrobe" && (
          <div>
            {wardrobe.length === 0 ? (
              <EmptyState onAdd={() => setView("add")} />
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1a1a2e" }}>My Closet</h2>
                  <button onClick={() => setView("add")} style={addBtnStyle}>+ Add Item</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
                  {wardrobe.map(item => (
                    <ClothingCard
                      key={item.id}
                      item={item}
                      onToggleDirty={() => toggleDirty(item.id)}
                      onRemove={() => removeItem(item.id)}
                      onPreview={() => setPreviewItem(item)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADD ITEM VIEW */}
        {view === "add" && (
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e", marginBottom: "1.5rem" }}>Add Clothing Item</h2>
            <div style={{ background: "#fff", borderRadius: 16, padding: "2rem", boxShadow: "0 2px 20px rgba(0,0,0,0.08)" }}>
              {/* Image Upload */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: addForm.imageData ? "none" : "2px dashed #ccc",
                  borderRadius: 12,
                  background: addForm.imageData ? "transparent" : "#fafafa",
                  cursor: "pointer",
                  marginBottom: "1.5rem",
                  overflow: "hidden",
                  minHeight: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 8,
                  transition: "border-color 0.2s",
                }}
              >
                {addForm.imageData ? (
                  <img src={addForm.imageData} alt="preview" style={{ width: "100%", borderRadius: 12, display: "block" }} />
                ) : (
                  <>
                    <span style={{ fontSize: 40 }}>📷</span>
                    <span style={{ color: "#888", fontSize: 14 }}>Tap to upload photo</span>
                  </>
                )}
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
                <select
                  value={addForm.category}
                  onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                  style={inputStyle}
                >
                  {["tops","bottoms","outerwear","shoes","accessories","dresses","other"].map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setView("wardrobe")} style={{ flex: 1, ...cancelBtnStyle }}>Cancel</button>
                <button
                  onClick={handleAdd}
                  disabled={!addForm.name || !addForm.imageData}
                  style={{ flex: 2, ...primaryBtnStyle, opacity: (!addForm.name || !addForm.imageData) ? 0.4 : 1 }}
                >
                  Add to Wardrobe
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OUTFITS VIEW */}
        {view === "outfits" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1a1a2e" }}>Your Outfits</h2>
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

            {!generating && outfits.length === 0 && genStatus && (
              <div style={{ textAlign: "center", padding: "4rem", color: "#888" }}>{genStatus}</div>
            )}

            {outfits.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {outfits.map((outfit, i) => (
                  <OutfitCard key={i} outfit={outfit} rank={i + 1} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Preview Modal */}
      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, overflow: "hidden", maxWidth: 400, width: "100%" }}>
            <img src={previewItem.imageData} alt={previewItem.name} style={{ width: "100%", maxHeight: 400, objectFit: "cover" }} />
            <div style={{ padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "#1a1a2e" }}>{previewItem.name}</div>
                  <div style={{ marginTop: 6 }}><CategoryBadge category={previewItem.category} /></div>
                </div>
                <span style={{
                  background: previewItem.dirty ? "#ffeeee" : "#eefff5",
                  color: previewItem.dirty ? "#c0392b" : "#27ae60",
                  padding: "4px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600
                }}>
                  {previewItem.dirty ? "🔴 Dirty" : "✅ Clean"}
                </span>
              </div>
              <button onClick={() => setPreviewItem(null)} style={{ marginTop: "1.25rem", width: "100%", ...cancelBtnStyle }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ icon, label, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span>{icon}</span>
      <span style={{ color: "#888", fontSize: 12 }}>{label}</span>
      <span style={{ color, fontWeight: 700, fontSize: 16 }}>{value}</span>
    </div>
  );
}

function ClothingCard({ item, onToggleDirty, onRemove, onPreview }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      border: item.dirty ? "2px solid #ff6b6b" : "2px solid transparent",
      transition: "all 0.2s",
      cursor: "pointer",
    }}>
      <div onClick={onPreview} style={{ position: "relative" }}>
        <img
          src={item.imageData}
          alt={item.name}
          style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
        />
        {item.dirty && (
          <div style={{ position: "absolute", top: 8, right: 8, background: "#ff6b6b", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
            DIRTY
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a2e", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
        <CategoryBadge category={item.category} />
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            onClick={onToggleDirty}
            title={item.dirty ? "Mark clean" : "Mark dirty"}
            style={{ flex: 1, border: "1px solid #eee", background: item.dirty ? "#fff5f5" : "#f5fff8", borderRadius: 7, padding: "5px 0", cursor: "pointer", fontSize: 14 }}
          >
            {item.dirty ? "🧺" : "✅"}
          </button>
          <button
            onClick={onRemove}
            title="Remove"
            style={{ border: "1px solid #eee", background: "#fff", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 14, color: "#e74c3c" }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function OutfitCard({ outfit, rank }) {
  const medals = ["🥇", "🥈", "🥉", ""];
  const rankColors = ["#e8c547", "#b0b0b0", "#cd7f32", "#ddd"];
  return (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 3px 20px rgba(0,0,0,0.09)",
      border: rank === 1 ? "2px solid #e8c547" : "1px solid #eee",
    }}>
      <div style={{
        background: rank === 1 ? "#1a1a2e" : "#f8f8f8",
        padding: "14px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>{medals[rank - 1] || "👗"}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: rank === 1 ? "#e8c547" : "#1a1a2e" }}>{outfit.name}</div>
            <StarRating score={outfit.styleScore} />
          </div>
        </div>
        <div style={{
          background: rankColors[rank - 1] || "#eee",
          color: rank <= 3 ? "#1a1a2e" : "#888",
          fontWeight: 800,
          fontSize: 13,
          borderRadius: 20,
          padding: "4px 12px",
        }}>
          #{rank}
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        {/* Outfit Items */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
          {outfit.items.map(item => (
            <div key={item.id} style={{ flex: "0 0 auto", textAlign: "center" }}>
              <img
                src={item.imageData}
                alt={item.name}
                style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, display: "block", border: "2px solid #f0f0f0" }}
              />
              <div style={{ fontSize: 11, color: "#888", marginTop: 4, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: "0 0 10px" }}>{outfit.description}</p>
        <div style={{ background: "#fffdf0", border: "1px solid #f0e8a0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#7a6000" }}>
          💡 <strong>Style tip:</strong> {outfit.tips}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>👕</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e", marginBottom: 8 }}>Your closet is empty</h2>
      <p style={{ color: "#888", marginBottom: "2rem" }}>Start by adding photos of your clothes</p>
      <button onClick={onAdd} style={primaryBtnStyle}>+ Add Your First Item</button>
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%", background: "#e8c547",
          animation: "bounce 1.2s infinite",
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.5);opacity:0.4} 40%{transform:scale(1);opacity:1} }`}</style>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1.5px solid #e0e0e0",
  borderRadius: 10,
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "#fafafa",
};
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 };
const primaryBtnStyle = { background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const cancelBtnStyle = { background: "#f0f0f0", color: "#333", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const addBtnStyle = { background: "#e8c547", color: "#1a1a2e", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
