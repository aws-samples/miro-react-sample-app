import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiClient } from "../common/api-client";

let timeout: number | null = null;
export function ShapePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate("/");
    }

    (async () => {
      const notes = await miro.board.getAppData(`shape-${id}`);
      if (typeof notes === "string") {
        setText(notes);
      } else {
        setText("");
      }
    })();
  }, [id, navigate]);

  const updateText = async (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!id) return;

    const text = event.target.value;
    setText(text);

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(async () => {
      await miro.board.setAppData(`shape-${id}`, text);
    }, 250);
  };

  const onSummarizeClick = async () => {
    setLoading(true);

    const api = new ApiClient();
    const result = await api.summarizeText(text);
    setText(result);
    await miro.board.setAppData(`shape-${id}`, result);

    setLoading(false);
  };

  return (
    <div className="page_shape">
      <textarea
        className="input shape_notes"
        placeholder="Notes..."
        value={text}
        onChange={updateText}
        maxLength={1000}
        disabled={loading}
      />
      <div>
        <button
          className="button button-primary"
          type="button"
          disabled={loading || text.trim().length === 0}
          onClick={onSummarizeClick}
          style={{ width: "100%", display: "flex", justifyContent: "center" }}
        >
          {!loading ? "Summarize" : "Loading..."}
        </button>
      </div>
    </div>
  );
}
