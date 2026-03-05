import { useLibraryStore } from "../store/libraryStore";

export default function LikeButton({ song, size = 18 }) {
  const { isLiked, likeSong, unlikeSong } = useLibraryStore();
  if (!song) return null;
  const liked = isLiked(song.id);

  const toggle = (e) => {
    e.stopPropagation();
    if (liked) unlikeSong(song.id);
    else likeSong(song);
  };

  return (
    <button onClick={toggle} title={liked ? "Unlike" : "Like"} style={{
      background: "none", border: "none", cursor: "pointer",
      color: liked ? "var(--accent)" : "var(--text-muted)",
      fontSize: `${size}px`, padding: "4px",
      transition: "color 0.15s, transform 0.1s",
    }}>
      {liked ? "♥" : "♡"}
    </button>
  );
}