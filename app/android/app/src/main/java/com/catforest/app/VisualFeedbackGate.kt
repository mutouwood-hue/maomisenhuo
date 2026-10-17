package com.catforest.app

/** Ephemeral presentation gate. It never changes game state, currency, or durable event handling. */
class VisualFeedbackGate(private val capacity: Int = 256) {
    private var active = false
    private val seen = linkedSetOf<String>()

    fun resume() { active = true }
    fun pause() { active = false } // no delayed queue, and seen IDs survive a pause/resume

    fun accept(eventId: String): Boolean {
        if (!active || eventId.isEmpty() || !seen.add(eventId)) return false
        while (seen.size > capacity) seen.remove(seen.first())
        return true
    }
}
