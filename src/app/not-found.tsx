import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page" style={{ textAlign: "center" }}>
      <h1 className="greeting">This page isn&apos;t on the shelf.</h1>
      <Link href="/" className="btn btn-primary">
        Find a room
      </Link>
    </main>
  );
}
