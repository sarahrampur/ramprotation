export const CURRENT_READ = {
  title: "The Opposite of Loneliness",
  author: "Marina Keegan",
  isbn: "9781476753614",
};

export function getCurrentRead() {
  const isbn = CURRENT_READ.isbn.replace(/[-\s]/g, "");
  const hasValidIsbn = /^(?:\d{9}[\dX]|\d{13})$/.test(isbn);

  return {
    title: CURRENT_READ.title.trim(),
    author: CURRENT_READ.author.trim(),
    cover: hasValidIsbn
      ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`
      : null,
  };
}