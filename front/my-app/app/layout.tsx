import { ChakraProvider } from '@chakra-ui/react'
import Header from "../components/Header";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          src={`https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places`}
          async
        ></script>
      </head>
      <body>
        <ChakraProvider>
        <Header />
          {children}
        </ChakraProvider>
      </body>
    </html>
  )
}