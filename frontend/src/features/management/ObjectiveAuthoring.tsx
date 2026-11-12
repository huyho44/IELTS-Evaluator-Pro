import { useState } from "react";
import axiosClient from "../../lib/api/axiosClient";
import ActionForm from "./ActionForm";
import { field, managementError } from "./managementApi";

export default function ObjectiveAuthoring({
  courseId,
  position,
  published,
  area,
  sectionId,
}: {
  area: string;
  sectionId: string;
  courseId: string;
  position: number;
  published: (id: string) => void;
}) {
  const [rows, setRows] = useState([{ id: 0, type: "SHORT_ANSWER", count: 2 }]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(data: FormData) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const questions = rows.map(({ id, type, count }) => {
        const lines = (name: string) =>
          String(data.get(name + id) ?? "")
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean);
        const prompt = data.get("prompt" + id);
        if (type === "SHORT_ANSWER")
          return { prompt, type, answers: lines("answers") };
        const options = Array.from({ length: count }, (_, i) =>
          String(data.get("option" + id + "-" + i) ?? "").trim(),
        );
        const correct = data.getAll("correct" + id).map(Number);
        return { type, prompt, options, correct };
      });
      const body = new FormData();
      body.append(
        "activity",
        JSON.stringify({
          title: data.get("title"),
          skillArea: area,
          position,
          sectionId: sectionId || null,
          prompt: data.get("passage"),
          instructions: data.get("instructions"),
          questions,
        }),
      );
      if (area === "LISTENING") {
        const file = data.get("audio");
        if (
          !(file instanceof File) ||
          !file.size ||
          file.size > 12 * 1024 * 1024
        )
          throw Error("Choose a recording up to 12 MB.");
        body.append("audio", file);
      }
      const result = await axiosClient.post(
        "/courses/" + courseId + "/objective-activities",
        body,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      published(result.data.activityVersionId);
      setMessage(
        "Activity published. Use the assignment form to assign it to the class.",
      );
      setRows([{ id: 0, type: "SHORT_ANSWER", count: 2 }]);
      return true;
    } catch (e) {
      setError(managementError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <ActionForm
      title="Publish activity"
      busy={busy}
      label="Publish activity"
      submit={submit}
    >
      <label className="block">
        Title
        <input required maxLength={240} className={field} name="title" />
      </label>
      <label className="block">
        {area === "READING" ? "Reading passage" : "Listening prompt"}
        <textarea required name="passage" className={field} />
      </label>
      {area === "LISTENING" && (
        <label className="block">
          Recording (up to 12 MB)
          <input
            required
            type="file"
            accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/ogg,audio/webm"
            name="audio"
          />
        </label>
      )}
      <label className="block">
        Instructions
        <textarea required name="instructions" className={field} />
      </label>
      {rows.map(({ id, type, count }, index) => (
        <fieldset key={id} className="space-y-2 rounded border p-3">
          <legend>Question {index + 1}</legend>
          <label className="block">
            Question text
            <input required className={field} name={"prompt" + id} />
          </label>
          <label className="block">
            Question type
            <select
              value={type}
              className={field}
              onChange={(e) =>
                setRows(
                  rows.map((r) =>
                    r.id === id ? { ...r, type: e.target.value } : r,
                  ),
                )
              }
            >
              <option value="SHORT_ANSWER">Short answer</option>
              <option value="SINGLE_CHOICE">Single choice</option>
              <option value="MULTIPLE_CHOICE">Multiple choice</option>
            </select>
          </label>
          {type === "SHORT_ANSWER" ? (
            <label className="block">
              Accepted answers (one per line)
              <textarea required name={"answers" + id} className={field} />
            </label>
          ) : (
            <>
              {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    aria-label={"Correct option " + (i + 1)}
                    type={type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                    name={"correct" + id}
                    value={i}
                  />
                  <input
                    required
                    aria-label={"Option " + (i + 1)}
                    placeholder={"Option " + (i + 1)}
                    className={field}
                    name={"option" + id + "-" + i}
                  />
                </div>
              ))}
              <p className="text-sm">
                Select the correct answer{type === "MULTIPLE_CHOICE" ? "s" : ""}{" "}
                beside the options.
              </p>
              <button
                type="button"
                disabled={count >= 20}
                onClick={() =>
                  setRows(
                    rows.map((r) =>
                      r.id === id ? { ...r, count: r.count + 1 } : r,
                    ),
                  )
                }
              >
                Add option
              </button>
              {count > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setRows(
                      rows.map((r) =>
                        r.id === id ? { ...r, count: r.count - 1 } : r,
                      ),
                    )
                  }
                >
                  Remove last option
                </button>
              )}
            </>
          )}
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => setRows(rows.filter((r) => r.id !== id))}
            >
              Remove question
            </button>
          )}
        </fieldset>
      ))}
      <button
        type="button"
        disabled={rows.length >= 40}
        onClick={() =>
          setRows([
            ...rows,
            {
              id: rows[rows.length - 1].id + 1,
              type: "SHORT_ANSWER",
              count: 2,
            },
          ])
        }
      >
        Add question
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </ActionForm>
  );
}
