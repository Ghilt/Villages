package villages.bots

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

/** The server's heap read from `jcmd GC.heap_info`, in the words of every JDK the toolchain has been on. */
class HeapWordsSpec : StringSpec({
    fun read(said: String) = JarServer.HEAP.find(said)?.groupValues?.drop(1)

    "JDK 21's words: the heap's total, and what of it is used" {
        read(" garbage-first heap   total 262144K, used 23456K [0x00000000f0000000, 0x0000000100000000)") shouldBe
            listOf("262144", "23456")
    }

    "JDK 25's words: what is reserved, what is committed, which is the heap the server has, and what is used" {
        read("garbage-first heap   total reserved 262144K, committed 131072K, used 25238K [0x00000000f0000000)") shouldBe
            listOf("131072", "25238")
    }
})
