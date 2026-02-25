
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { AlertTriangle, Music, BookOpen, CheckCircle2, Users } from "lucide-react";
import { useAuth } from '../utils/auth';
import { toast } from 'sonner';
import { notifyAccountabilityPartners, UserProfile } from '../utils/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const AVAILABLE_MEDITATIONS = [
  { id: '1', title: 'Urge Surfing', description: 'Learn to ride the wave of desire without giving in', duration: 10 },
  { id: '2', title: 'Morning Clarity', description: 'Start your day with purpose and clear intentions', duration: 5 },
  { id: '3', title: 'Body Scan For Relaxation', description: 'Release tension and find deep relaxation', duration: 15 },
  { id: '6', title: 'Before Sleep Relaxation', description: 'Calm your mind and body with this soothing practice', duration: 10 },
];

const COPING_ACTIVITIES = [
  "Take 10 slow, deep breaths — inhale for 4 counts, hold for 4, exhale for 4",
  "Go for a brisk 5-minute walk or do 20 jumping jacks",
  "Drink a large glass of cold water",
  "Splash cold water on your face",
  "Call or text a trusted friend or family member",
  "Write down 3 things you're grateful for right now",
  "Put on your favorite uplifting music and move your body",
  "Recite an affirmation: 'This craving will pass. I am stronger than this urge.'",
  "Delay the decision by 15 minutes — set a timer and do something else",
  "Remind yourself of your 'why' — the reason you started this journey",
];

interface PanicButtonProps {
  onEmergencyClick?: () => void;
  className?: string;
}

const PanicButton: React.FC<PanicButtonProps> = ({ onEmergencyClick, className }) => {
  const { currentUser, accountabilityPartners } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [suggestedMeditation, setSuggestedMeditation] = useState(AVAILABLE_MEDITATIONS[0]);

  const handleOpen = () => {
    if (!currentUser) {
      toast.error('You must be logged in to use this feature.');
      return;
    }
    setSelectedPartners(accountabilityPartners.map((p) => p.id));
    setNotified(false);
    setSuggestedMeditation(
      AVAILABLE_MEDITATIONS[Math.floor(Math.random() * AVAILABLE_MEDITATIONS.length)]
    );
    setOpen(true);
  };

  const togglePartner = (id: string) => {
    setSelectedPartners((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleNotify = async () => {
    if (!currentUser) return;
    setNotifying(true);
    try {
      await notifyAccountabilityPartners(
        currentUser.uid,
        'emergency',
        'has pressed the emergency button and needs support',
        selectedPartners
      );
      setNotified(true);
      if (onEmergencyClick) onEmergencyClick();
      toast.success('Your selected partners have been notified!');
    } finally {
      setNotifying(false);
    }
  };

  const getInitials = (partner: Pick<UserProfile, 'firstName' | 'lastName'>) =>
    ((partner.firstName?.[0] || '') + (partner.lastName?.[0] || '')).toUpperCase() || 'U';

  return (
    <>
      <Button variant="destructive" className={className} onClick={handleOpen}>
        <AlertTriangle className="mr-2 h-4 w-4" />
        Emergency Support
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Emergency Support
            </DialogTitle>
            <DialogDescription>
              You've got this. Use these tools to get through the craving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Coping Activities */}
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Do one of these right now
              </h3>
              <ul className="space-y-1">
                {COPING_ACTIVITIES.map((activity, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/50"
                  >
                    <span className="font-semibold text-muted-foreground min-w-[1.2rem]">
                      {i + 1}.
                    </span>
                    {activity}
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            {/* Suggested Meditation */}
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Music className="h-4 w-4 text-blue-500" />
                Suggested Meditation
              </h3>
              <div className="p-3 rounded-md border bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{suggestedMeditation.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {suggestedMeditation.description}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {suggestedMeditation.duration} min
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => { setOpen(false); navigate('/meditations'); }}
                >
                  Open Meditations →
                </Button>
              </div>
            </div>

            <Separator />

            {/* Journal Prompt */}
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-purple-500" />
                Journal Prompt
              </h3>
              <div className="p-3 rounded-md border bg-muted/30">
                <p className="text-sm italic">
                  "What triggered this craving, and what can I do differently next time?"
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => { setOpen(false); navigate('/journal'); }}
                >
                  Open Journal →
                </Button>
              </div>
            </div>

            <Separator />

            {/* Partner Notification */}
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-500" />
                Notify Accountability Partners
              </h3>
              {accountabilityPartners.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You have no accountability partners yet. Add partners from your friends list.
                </p>
              ) : (
                <div className="space-y-1">
                  {accountabilityPartners.map((partner) => (
                    <label
                      key={partner.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedPartners.includes(partner.id)}
                        onCheckedChange={() => togglePartner(partner.id)}
                        disabled={notified}
                      />
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">{getInitials(partner)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {partner.firstName} {partner.lastName}
                        {partner.username && (
                          <span className="text-muted-foreground ml-1">@{partner.username}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            {accountabilityPartners.length > 0 && (
              <Button
                variant="destructive"
                onClick={handleNotify}
                disabled={notifying || notified || selectedPartners.length === 0}
              >
                {notified ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Partners Notified
                  </>
                ) : notifying ? (
                  'Notifying...'
                ) : (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Notify Selected Partners
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PanicButton;
