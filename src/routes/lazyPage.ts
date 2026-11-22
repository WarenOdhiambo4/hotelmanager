import { lazy, type ComponentType } from 'react'

/** A page loaded on demand, so a first visit on campus mobile data downloads only what it shows. */
export const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

const auth = () => import('../pages/auth/AuthPages')
export const Login = page(auth, 'Login')
export const SignUp = page(auth, 'SignUp')
export const ForgotPassword = page(auth, 'ForgotPassword')
export const ResetPassword = page(auth, 'ResetPassword')
