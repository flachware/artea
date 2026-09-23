# Artea

The Artea curve is a cubic Bézier curve that approximates the minimum curvature peak. The curvature is expressed in terms of the tangent ratio and optimized using a superellipse with $n=4/3$.

The Artea spline generalizes the Artea curve as a sequence of optimized segments. Its construction expresses curvature in terms of ratio and scale. Each segment starts as an Artea curve, with smooth joins that approximate $G^2$ continuity through a closed-form solution.

Explore the [prototype implementation](https://flachware.com/artea/).

## Cubic Bézier curve

$$
B(t) =
\sum_{i=0}^{3}
\binom{3}{i}
(1-t)^{3-i}t^iP_i
$$

## Artea curve

The endpoints and the tangent intersection point are given:

$$
P_0,\ P_3,\ T
$$

The tangent lengths are obtained from these points:

$$
t_1=\lVert T-P_0\rVert,
\qquad
t_2=\lVert T-P_3\rVert
$$

with

$$
\alpha=\max(t_1,t_2),
\qquad
\beta=\min(t_1,t_2).
$$

The tangent ratio is

$$
r=\frac{2\beta}{\alpha+\beta}.
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
x=1-p,
\qquad
y=(1-\kappa)(2-r)^{3/4},
\qquad
a=2^{3/4}(1-\kappa)
$$

where

$$
\kappa=\frac{4(\sqrt{2}-1)}{3}.
$$

Solving the superellipse for the optimized parameter $p$ gives:

$$
p=1-(1-\kappa)r^{3/4}.
$$

The inner control points are then:

$$
P_1=P_0+p(T-P_0),
\qquad
P_2=P_3+p(T-P_3).
$$

## Artea spline

Each segment of the spline has its own endpoints $P_0$, $P_3$ and tangent intersection point $T$, from which $t_1$, $t_2$, $\alpha$, $\beta$, and the Artea curve $p_A$ are computed exactly as for the single curve above.

### Endpoint curvature

Each endpoint has an optimized curvature factor:

$$
q_0=\frac{1-p_A}{p_A^2},
\qquad
q_3=\frac{1-p_A}{p_A^2}
$$

and a scale factor:

$$
S_0=\frac{t_2}{t_1^2},
\qquad
S_3=\frac{t_1}{t_2^2}.
$$

The endpoint curvatures are expressed as:

$$
A_0=q_0S_0,
\qquad
A_3=q_3S_3.
$$

### Smooth joins

The construction above applies to every segment of the spline.

At a smooth join between segment $i$ and segment $i+1$, the two touching endpoints share the smaller of the endpoint curvatures of their respective Artea curves:

$$
J_{3,i}=J_{0,i+1}=
\min\left(A_{3,i},A_{0,i+1}\right)
$$

This is the least invasive choice: neither endpoint exceeds the curvature of its Artea curve.

At a free chain end, or at a corner where the tangent is not shared, there is no neighboring value to take a minimum with, so the endpoint's curvature measure is simply defined as its own reference:

$$
J_0=A_0
\qquad\text{or}\qquad
J_3=A_3
$$

The endpoint parameters are then obtained directly from the inverse of $q$:

$$
q^{-1}(x)=\frac{2}{1+\sqrt{1+4x}}
$$

giving

$$
p_{3,i}=
q^{-1}\left(\frac{J_{3,i}}{S_{3,i}}\right),
\qquad
p_{0,i+1}=
q^{-1}\left(\frac{J_{0,i+1}}{S_{0,i+1}}\right).
$$

Finally, the Bézier control points are constructed from the resulting parameters:

$$
P_1=P_0+p_0(T-P_0),
\qquad
P_2=P_3+p_3(T-P_3).
$$

---

Copyright © 2026 Johannes Krtek
