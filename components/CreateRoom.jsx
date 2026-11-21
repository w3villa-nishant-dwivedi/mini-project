
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateRoom() {
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [createdRoom, setCreatedRoom] = useState(null);

  async function handleCreateRoom() {
    if (!roomName.trim()) {
      setMessage("Please enter a room name");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Room creation failed");
      }

      setCreatedRoom(data.room);
      setRoomName("");
      setMessage("Room created successfully!");

    } catch (error) {
      console.error(error);
      setMessage(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button className="bg-purple-600 px-7 text-md font-extrabold cursor-pointer py-6.5 rounded-lg mt-5 hover:bg-purple-600">
            Create Room
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md bg-foreground text-background">
        <DialogHeader>
          <DialogTitle>Create your room 🎬</DialogTitle>
          <DialogDescription>
            Enter your details to start a private watch party.
          </DialogDescription>
        </DialogHeader>

        {!createdRoom ? (
          <>
            <FieldGroup>
              <Field>
                <Label htmlFor="roomName">Room Name</Label>
                <Input
                  id="roomName"
                  name="roomName"
                  placeholder="e.g. Friday Movie Night"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  maxLength={60}
                  className="bg-background text-foreground"
                />
              </Field>
            </FieldGroup>

            {message && (
              <p className="text-sm text-red-500">{message}</p>
            )}

            <DialogFooter>
              <DialogClose
                render={
                  <Button variant="outline" className="bg-background text-foreground">
                    Cancel
                  </Button>
                }
              />

              <Button
                type="button"
                onClick={handleCreateRoom}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-500"
              >
                {loading ? "Creating..." : "Create Room"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-green-500 text-sm">{message}</p>

              <div>
                <p className="text-sm font-medium">Room Name</p>
                <p>{createdRoom.name}</p>
              </div>

              <div>
                <p className="text-sm font-medium">Invite Code</p>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-foreground text-background border-background border hover:bg-background hover:text-foreground p-3">
                    {createdRoom.inviteCode}
                  </code>

                  <Button
                    
                    className="bg-foreground text-background cursor-pointer px-5 border-background hover:bg-background hover:text-foreground"
                    onClick={() =>
                      navigator.clipboard.writeText(createdRoom.inviteCode)
                    }
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose
                render={<Button variant="outline"
                className="bg-foreground text-background cursor-pointer "
                >
                  
                  Close</Button>}
              />
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
