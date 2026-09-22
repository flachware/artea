# Artea

The Artea curve is a cubic Bézier curve whose control points are constructed to approximate the minimum curvature peak. The optimization is geometrically defined by a superellipse with $n=4/3$. The construction first normalizes the tangent geometry to right angles while preserving the ratio of the tangent lengths, performs the optimization in this normalized geometry, and then applies the affine inclination.

The Artea spline is a generalization of the Artea curve from a single cubic Bézier segment to a piecewise-cubic Bézier curve. It approximates $G^2$ continuity at smooth joins by matching a decoupled endpoint curvature representation. Each endpoint is controlled independently, so every smooth join reduces to a single closed-form equation. The resulting construction is deterministic and requires no iterative solver.

## Cubic Bézier curve

$$
B(t) =
\sum_{i=0}^{3}
\binom{3}{i}
(1-t)^{3-i} t^i P_i
$$

## Artea curve

The endpoints and the tangent intersection point are given:

$$
P_0,\ P_3,\ T
$$

The tangent lengths are obtained from these points:

$$
t_1 = \lVert T-P_0\rVert,\qquad
t_2 = \lVert T-P_3\rVert
$$

with

$$
A = \max(t_1,t_2),\qquad
B = \min(t_1,t_2)
$$

The curvature optimization is defined by the superellipse:

$$
\left|\frac{x}{a}\right|^{4/3}
+
\left|\frac{y}{a}\right|^{4/3}
=1
$$

with

$$
x=1-p,\qquad
y=(1-\gamma)\left(\frac{2B}{A+B}\right)^{3/4},
\qquad
a=2^{3/4}(1-\gamma)
$$

where

$$
\gamma=\frac{4(\sqrt{2}-1)}{3}
$$

Solving the superellipse for $p$ gives:

$$
p=
1-(1-\gamma)
\left(\frac{2B}{A+B}\right)^{3/4}
$$

The inner control points are then:

$$
P_1=P_0+p(T-P_0),\qquad
P_2=P_3+p(T-P_3)
$$

## Artea spline

Each segment provides its endpoints and tangent intersection point:

$$
P_{0,i},\ P_{3,i},\ T_i
$$

From these points, the two tangent lengths are calculated:

$$
t_{1,i}=\lVert T_i-P_{0,i}\rVert,\qquad
t_{2,i}=\lVert T_i-P_{3,i}\rVert
$$

and

$$
A_i=\max(t_{1,i},t_{2,i}),\qquad
B_i=\min(t_{1,i},t_{2,i})
$$

### Artea reference

The Artea parameter for each segment is calculated in exactly the same way as for a single curve:

$$
p_{A,i} =
1-(1-\gamma)
\left(\frac{2B_i}{A_i+B_i}\right)^{3/4}
$$

with

$$
\gamma=\frac{4(\sqrt{2}-1)}{3}.
$$

This value defines the lower bound for both endpoint parameters:

$$
p_i\ge p_{A,i},\qquad
e_i\ge p_{A,i}.
$$

The two endpoints of a spline segment are then allowed to move independently toward $T_i$:

$$
P_{1,i}=P_{0,i}+p_i(T_i-P_{0,i}),
$$

$$
P_{2,i}=P_{3,i}+e_i(T_i-P_{3,i})
$$

### Decoupled endpoint curvature measure

The endpoint curvature measures are written as a product of two factors:

$$
J_{s,i}=q(p_i)F_{s,i},
\qquad
J_{e,i}=q(e_i)F_{e,i}.
$$

The first factor depends on the corresponding control parameter:

$$
q(p)=\frac{1-p}{p^2},
\qquad
q^{-1}(x)=\frac{2}{1+\sqrt{1+4x}}
$$

Here, $p_i$ is the control parameter at the start of segment $i$, and $e_i$ is the control parameter at its end. They determine the positions of the corresponding inner control points:

$$
P_{1,i}=P_{0,i}+p_i(T_i-P_{0,i}),
$$

$$
P_{2,i}=P_{3,i}+e_i(T_i-P_{3,i})
$$

The second factor depends only on the tangent geometry of the segment. It is determined by the two tangent lengths:

$$
t_{1,i}=\lVert T_i-P_{0,i}\rVert,\qquad
t_{2,i}=\lVert T_i-P_{3,i}\rVert
$$

and is given by

$$
F_{s,i}=\frac{t_{2,i}}{t_{1,i}^{2}},
\qquad
F_{e,i}=\frac{t_{1,i}}{t_{2,i}^{2}}
$$

Thus, $q(p_i)$ and $q(e_i)$ describe the effect of the control parameters, while $F_{s,i}$ and $F_{e,i}$ describe the effect of the tangent geometry.

The endpoint curvature measures are therefore the product of the parameter-dependent factor and the tangent-geometry factor:

$$
J_{s,i}=q(p_i)F_{s,i},
\qquad
J_{e,i}=q(e_i)F_{e,i}
$$

Once the segment points are given, the tangent lengths and therefore $F_{s,i}$ and $F_{e,i}$ are determined by the tangent geometry. The control parameters $p_i$ and $e_i$ can then be varied independently to change the corresponding endpoint curvature measures.

For the Artea reference $p_{A,i}$, the corresponding endpoint curvature measures are:

$$
J_{sA,i}=q(p_{A,i})F_{s,i},
\qquad
J_{eA,i}=q(p_{A,i})F_{e,i}
$$

Because $q(p)$ decreases monotonically with $p$, the Artea parameter bound

$$
p_i\ge p_{A,i},\qquad
e_i\ge p_{A,i}
$$

corresponds to the curvature-measure bounds

$$
J_{s,i}\le J_{sA,i},
\qquad
J_{e,i}\le J_{eA,i}.
$$

Thus, $p_{A,i}$ is a lower bound on the control parameters, while the corresponding Artea values $J_{sA,i}$ and $J_{eA,i}$ are upper bounds on the endpoint curvature measures.

### Smooth joins

At a smooth join between segment $i$ and segment $i+1$, the two endpoint curvature measures are matched:

$$
J_{e,i}=J_{s,i+1}
$$

The common value must satisfy both Artea upper bounds:

$$
J_{e,i}\le J_{eA,i},
\qquad
J_{s,i+1}\le J_{sA,i+1}
$$

Therefore, the largest common value that satisfies both bounds is the smaller of the two reference values:

$$
J_{e,i}=J_{s,i+1} =
\min\left(J_{eA,i},J_{sA,i+1}\right)
$$

This choice is the least invasive one: neither endpoint is pushed beyond its own Artea reference.

Because the two endpoint measures are decoupled, the corresponding control parameters can be recovered independently using the inverse of $q$:

$$
e_i=
q^{-1}\left(\frac{J_{e,i}}{F_{e,i}}\right)
$$

and

$$
p_{i+1}=
q^{-1}\left(\frac{J_{s,i+1}}{F_{s,i+1}}\right)
$$

No coupled system needs to be solved.

At a free chain end, or at a corner where the tangent is not shared, the endpoint remains at its own Artea reference:

$$
J_{s,i}=J_{sA,i}
\qquad\text{or}\qquad
J_{e,i}=J_{eA,i}.
$$

Finally, the Bézier control points are constructed from the resulting parameters:

$$
P_{1,i}=P_{0,i}+p_i(T_i-P_{0,i}),
$$

$$
P_{2,i}=P_{3,i}+e_i(T_i-P_{3,i}).
$$

---

Copyright © 2026 Johannes Krtek

