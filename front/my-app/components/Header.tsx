"use client";

import { Box, Heading, Flex, useColorModeValue } from '@chakra-ui/react'; // Boxを正しくインポート
import ThemeToggleButton from './Theme-toggle-button'

// NavbarProps の型定義
type NavbarProps = {
    path: string;
}

const Navbar = ({ path }: NavbarProps) => {
    return (
        <Box
            position="fixed"
            as="nav"
            w="100%"
            bg={useColorModeValue('#ffffff40', '#20202380')}
            style={{ backdropFilter: 'blur(10px)' }}
            zIndex={1}
            px={10}
        >
            <Box maxW="container.md" p={2} display="flex" justifyContent="space-between" alignItems="center">
                <Flex align="center" w="100%">
                    <Flex align="center" mr={5}>
                        <Heading as="h1" size="lg" letterSpacing={'tighter'}>
							Family Routes
                        </Heading>
                    </Flex>
                </Flex>
            </Box>
        </Box>
    )
}

export default Navbar;
