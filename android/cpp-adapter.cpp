#include <jni.h>
#include "rn-local-p2p.h"

extern "C"
JNIEXPORT jdouble JNICALL
Java_com_rnlocalp2p_RnLocalP2pModule_nativeMultiply(JNIEnv *env, jclass type, jdouble a, jdouble b) {
    return rnlocalp2p::multiply(a, b);
}
