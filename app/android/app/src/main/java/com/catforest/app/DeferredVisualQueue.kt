package com.catforest.app

/** Bounded foreground-only presentation memory. Never stores or replays a game operation. */
class DeferredVisualQueue(private val capacity: Int = 12) {
    data class Event(val eventId: String, val petId: String, val sourceRevision: Long, val payload: String)
    private val pending = ArrayDeque<Event>()
    var droppedVisuals: Long = 0
        private set
    val size: Int get() = pending.size

    init { require(capacity > 0) }

    fun enqueue(event: Event): Boolean {
        require(event.eventId.isNotEmpty() && event.petId.isNotEmpty() && event.sourceRevision >= 0)
        if (pending.any { it.eventId == event.eventId }) return false
        if (pending.size == capacity) { pending.removeFirst(); droppedVisuals++ }
        pending.addLast(event)
        return true
    }

    fun drain(petId: String, revision: Long): List<Event> {
        val ready = mutableListOf<Event>()
        while (pending.isNotEmpty()) {
            val event = pending.removeFirst()
            if (event.petId == petId && event.sourceRevision <= revision) ready.add(event)
            else droppedVisuals++
        }
        return ready
    }

    fun clear() { pending.clear() }
}
