'use client'

import { useState } from 'react'
import AdminPage from "./Admin"
import PasswordProtection from "./PasswordProtection"

export default function Page() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    if (!isAuthenticated) {
        return <PasswordProtection onSuccess={() => setIsAuthenticated(true)} />
    }

    return (
        <div>
            <AdminPage />
        </div>
    )
}
