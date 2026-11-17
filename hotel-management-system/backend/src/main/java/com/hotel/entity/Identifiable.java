package com.hotel.entity;

/**
 * Contract for every domain entity stored in a repository.
 * IDs are human-readable strings (e.g. "RM-101", "BK-0001") shared with the frontend seed data,
 * so the same identifiers work in mock mode and against this API.
 */
public interface Identifiable {

    String getId();

    void setId(String id);
}
