// Map a Saavn Worker SongModel to our internal song object
export const saavnToSong = (s) => ({
  id: s.id,
  title: s.name,
  artist: s.artists?.primary?.map((a) => a.name).join(", ") || "Unknown Artist",
  duration: parseInt(s.duration) || 0,
  thumbnail:
    s.image?.find((i) => i.quality === "500x500")?.url ||
    s.image?.[s.image.length - 1]?.url ||
    "",
  downloadUrl: s.downloadUrl || [],
  source: "saavn",
});