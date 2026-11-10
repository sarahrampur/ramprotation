export const CURRENT_READ = {
  title: "",
  isbn: "",
};

export function getCurrentRead() {
  const isbn = CURRENT_READ.isbn.replace(/[-\s]/g, "");
  const hasValidIsbn = /^(?:\d{9}[\dX]|\d{13})$/.test(isbn);

  return {
    title: CURRENT_READ.title.trim(),
    cover: hasValidIsbn
      ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`
      : null,
  };
}