import { Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { HomePage } from "./pages/home";
import { ShapePage } from "./pages/shape";
import Layout from "./layout";

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = async () => {
      const selection = await miro.board.getSelection();
      if (selection.length === 1) {
        const id = selection[0].id;

        navigate(`/shape/${id}`);
      } else {
        navigate("/");
      }
    };

    miro.board.ui.on("selection:update", handler);

    return () => {
      miro.board.ui.off("selection:update", handler);
    };
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="shape/:id" element={<ShapePage />} />
      </Route>
    </Routes>
  );
}
