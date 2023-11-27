import React, { useEffect } from "react";
import { Utils } from "../common/utils";
import { useNavigate } from "react-router-dom";
import { shapes } from "../common/shapes";

export function HomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    (async () => {
      const selection = await miro.board.getSelection();
      if (selection.length === 1) {
        const id = selection[0].id;

        navigate(`/shape/${id}`);
      }
    })();
  }, [navigate]);

  const onShapeClick = async (shape: string) => {
    if (loading) return;
    setLoading(true);

    const origin = window.location.origin;
    const response = await fetch(`${origin}/shapes/${shape}`);
    const blob = await response.blob();
    const dataUrl = await Utils.blobToDataURL(blob);
    const viewport = await miro.board.viewport.get();
    const min = Math.min(viewport.width, viewport.height);

    const image = await miro.board.createImage({
      title: "Shape",
      url: dataUrl,
      width: Math.max(64, min / 8),
      rotation: 0.0,
      x: viewport.x + viewport.width / 2,
      y: viewport.y + viewport.height / 2,
    });

    console.log(image);
    setLoading(false);
  };

  const grayScale = loading ? { filter: "grayscale(100%)" } : {};

  return (
    <div className="shape_grid">
      {shapes.map((shape) => (
        <div key={shape} className="shape_grid_item">
          <img
            src={`/shapes/${shape}`}
            alt={shape}
            onClick={() => onShapeClick(shape)}
            style={{ ...grayScale }}
          />
        </div>
      ))}
    </div>
  );
}
