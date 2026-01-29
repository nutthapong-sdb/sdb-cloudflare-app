'use client';
import Sidebar from './Sidebar';

export default function SystemsLayout({ children }) {
    return (
        <div className="flex min-h-screen bg-black">
            <Sidebar />
            <main className="flex-1 min-w-0 relative">
                {children}
            </main>
        </div>
    );
}
