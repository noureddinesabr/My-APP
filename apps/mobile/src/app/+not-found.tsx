import { Redirect } from 'expo-router';

/** Unknown addresses (e.g. an old link) go back to the start screen. */
export default function NotFound() {
  return <Redirect href="/" />;
}
