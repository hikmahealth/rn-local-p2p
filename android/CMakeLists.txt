cmake_minimum_required(VERSION 3.4.1)
project(RnLocalP2p)

set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 14)

add_library(rn-local-p2p            SHARED
            ../cpp/rn-local-p2p.cpp
            cpp-adapter.cpp
)

# Specifies a path to native header files.
include_directories(
            ../cpp
)
