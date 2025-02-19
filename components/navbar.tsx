"use client"
import { Button } from "./ui/button";
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between w-full h-24 px-4 py-10 backdrop-blur-md bg-background/80 md:px-8 lg:px-12 xl:px-16 2xl:px-24">
      <Link href="/" className="text-2xl font-bold">
        ConvertX
      </Link>
      <div className="items-center hidden gap-2 md:flex">
        <ModeToggle />
      </div>
      <div className="block p-3 md:hidden">
        <ModeToggle />
      </div>
    </nav>
  );
}
