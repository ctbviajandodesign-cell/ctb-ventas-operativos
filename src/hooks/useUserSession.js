import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Hook to manage user session and profile data.
 * Fetches the authenticated user and their corresponding profile from Supabase.
 *
 * @returns {Object} { user, profile, isAdmin, loading, error }
 */
export function useUserSession() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchSession() {
      try {
        setLoading(true)
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError) throw authError
        if (!user) {
          setLoading(false)
          return
        }

        setUser(user)

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) throw profileError

        setProfile(profileData)
        setIsAdmin(profileData?.rol === 'admin' || profileData?.rol === 'superadmin')
      } catch (err) {
        console.error('Error fetching user session:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [])

  return { user, profile, isAdmin, loading, error }
}
